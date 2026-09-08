package controller

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// 画布历史保留上限。历史默认全部保留，仅在超过该上限时清理最旧的记录以
// 控制磁盘占用；这里给到 2000，避免生成一次后历史被误清。
const canvasHistoryLimit = 2000
const canvasHistoryMaxImageBytes int64 = 15 << 20

func canvasHistoryDir() string {
	if dir := strings.TrimSpace(os.Getenv("CANVAS_HISTORY_DIR")); dir != "" {
		return dir
	}
	return "history"
}

func canvasHistoryFilePath(userID int, imageID string, createdAt time.Time) string {
	digest := sha256.Sum256([]byte(imageID))
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	return filepath.Join(canvasHistoryDir(), strconv.Itoa(userID), fmt.Sprintf("%d-%s.png", createdAt.UnixNano(), hex.EncodeToString(digest[:8])))
}

func pathWithinRoot(root, path string) bool {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	pathAbs, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, pathAbs)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func migrateCanvasHistoryFile(row *model.CanvasHistory) error {
	if row == nil || row.FilePath == "" {
		return nil
	}
	if pathWithinRoot(filepath.Join(canvasHistoryDir(), strconv.Itoa(row.UserID)), row.FilePath) {
		return nil
	}
	if !pathWithinRoot(filepath.Join("data", "canvas-history"), row.FilePath) {
		return nil
	}
	if _, err := os.Stat(row.FilePath); err != nil {
		return err
	}
	oldPath := row.FilePath
	newPath := canvasHistoryFilePath(row.UserID, row.ImageID, row.CreatedAt)
	if err := os.MkdirAll(filepath.Dir(newPath), 0750); err != nil {
		return err
	}
	source, err := os.Open(row.FilePath)
	if err != nil {
		return err
	}
	defer source.Close()
	target, err := os.OpenFile(newPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	if _, err = io.Copy(target, source); err != nil {
		_ = target.Close()
		_ = os.Remove(newPath)
		return err
	}
	if err = target.Close(); err != nil {
		_ = os.Remove(newPath)
		return err
	}
	if err = model.DB.Model(row).Update("file_path", newPath).Error; err != nil {
		_ = os.Remove(newPath)
		return err
	}
	row.FilePath = newPath
	return os.Remove(oldPath)
}

func canvasHistoryImage(ctx context.Context, item map[string]any) ([]byte, string, error) {
	if raw, ok := item["b64_json"].(string); ok && raw != "" {
		mime, data := "image/png", raw
		if strings.HasPrefix(raw, "data:") {
			parts := strings.SplitN(raw, ",", 2)
			if len(parts) != 2 {
				return nil, "", fmt.Errorf("invalid image data")
			}
			mime = strings.TrimPrefix(strings.SplitN(parts[0], ";", 2)[0], "data:")
			data = parts[1]
		}
		decoded, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil, "", fmt.Errorf("invalid image data: %w", err)
		}
		if int64(len(decoded)) > canvasHistoryMaxImageBytes {
			return nil, "", fmt.Errorf("image exceeds 15MB limit")
		}
		return decoded, mime, nil
	}
	if raw, ok := item["url"].(string); ok && raw != "" {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return nil, "", fmt.Errorf("invalid image url")
		}
		// An empty domain whitelist means the deployment has not configured the
		// optional SSRF filter. Keep upstream image persistence functional then;
		// configured filters are still enforced.
		if len(common.DefaultSSRFProtection.DomainList) > 0 {
			if err := common.DefaultSSRFProtection.ValidateURL(raw); err != nil {
				return nil, "", err
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
		if err != nil {
			return nil, "", err
		}
		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, "", fmt.Errorf("upstream image status %d", resp.StatusCode)
		}
		if resp.ContentLength > canvasHistoryMaxImageBytes {
			return nil, "", fmt.Errorf("image exceeds 15MB limit")
		}
		data, err := io.ReadAll(io.LimitReader(resp.Body, canvasHistoryMaxImageBytes+1))
		if err != nil {
			return nil, "", err
		}
		if int64(len(data)) > canvasHistoryMaxImageBytes {
			return nil, "", fmt.Errorf("image exceeds 15MB limit")
		}
		mime := resp.Header.Get("Content-Type")
		if mime == "" {
			mime = "image/png"
		}
		return data, strings.Split(mime, ";")[0], nil
	}
	return nil, "", nil
}

func canvasUserID(c *gin.Context) int {
	if c == nil {
		return 0
	}
	return c.GetInt("id")
}

// GetCanvasHistory returns only the authenticated user's canvas history.
func GetCanvasHistory(c *gin.Context) {
	userID := canvasUserID(c)
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	var rows []model.CanvasHistory
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(canvasHistoryLimit).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	items := make([]any, 0, len(rows))
	for i := range rows {
		_ = migrateCanvasHistoryFile(&rows[i])
		var payload any
		if err := common.UnmarshalJsonStr(rows[i].Payload, &payload); err != nil {
			continue
		}
		if obj, ok := payload.(map[string]any); ok && rows[i].FilePath != "" {
			obj["url"] = "/api/canvas/history/" + url.PathEscape(rows[i].ImageID) + "/image"
			delete(obj, "b64_json")
			payload = obj
		}
		items = append(items, payload)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

type canvasHistoryUpsertRequest struct {
	Items []map[string]any `json:"items"`
}

// SaveCanvasHistory persists metadata and image bytes on the server.
func SaveCanvasHistory(c *gin.Context) {
	userID := canvasUserID(c)
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	var req canvasHistoryUpsertRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "items is required"})
		return
	}
	for _, item := range req.Items {
		id, ok := item["id"].(string)
		if !ok || id == "" {
			continue
		}
		imageBytes, mime, err := canvasHistoryImage(c.Request.Context(), item)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		delete(item, "b64_json")
		delete(item, "url")
		// 参考图是上传的大图 base64，不应持久化到数据库（否则 payload 超长，
		// 触发 MySQL Data too long）。历史展示与草稿恢复只需生成结果的元数据。
		delete(item, "referenceImage")
		payload, err := common.Marshal(item)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		var row model.CanvasHistory
		result := model.DB.Where("user_id = ? AND image_id = ?", userID, id).First(&row)
		if result.Error != nil {
			row = *model.NewCanvasHistory(userID, id, string(payload))
		} else {
			row.Payload = string(payload)
			row.UpdatedAt = time.Now()
		}
		row.UserID = userID
		row.ImageID = id
		if len(imageBytes) > 0 {
			if row.FilePath != "" {
				_ = migrateCanvasHistoryFile(&row)
			}
			if err := os.MkdirAll(filepath.Dir(canvasHistoryFilePath(userID, id, row.CreatedAt)), 0750); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
				return
			}
			if row.FilePath == "" {
				row.FilePath = canvasHistoryFilePath(userID, id, row.CreatedAt)
			}
			if err := os.WriteFile(row.FilePath, imageBytes, 0600); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
				return
			}
			row.MimeType = mime
		}
		if err := model.DB.Save(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
	}
	var rows []model.CanvasHistory
	model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&rows)
	if len(rows) > canvasHistoryLimit {
		for _, row := range rows[canvasHistoryLimit:] {
			if row.FilePath != "" {
				_ = os.Remove(row.FilePath)
			}
			model.DB.Delete(&row)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetCanvasHistoryImage serves a persisted image only to its owner.
func GetCanvasHistoryImage(c *gin.Context) {
	userID, imageID := canvasUserID(c), c.Param("image_id")
	if userID <= 0 {
		c.Status(http.StatusUnauthorized)
		return
	}
	var row model.CanvasHistory
	if err := model.DB.Where("user_id = ? AND image_id = ?", userID, imageID).First(&row).Error; err != nil || row.FilePath == "" {
		c.Status(http.StatusNotFound)
		return
	}
	if err := migrateCanvasHistoryFile(&row); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if !pathWithinRoot(filepath.Join(canvasHistoryDir(), strconv.Itoa(userID)), row.FilePath) {
		c.Status(http.StatusNotFound)
		return
	}
	file, err := os.Open(row.FilePath)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()
	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	contentType := row.MimeType
	if contentType == "" {
		contentType = "image/png"
	}
	c.DataFromReader(http.StatusOK, -1, contentType, file, nil)
}

// DeleteCanvasHistory clears only the authenticated user's canvas history.
func DeleteCanvasHistory(c *gin.Context) {
	userID := canvasUserID(c)
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "unauthorized"})
		return
	}
	var rows []model.CanvasHistory
	_ = model.DB.Where("user_id = ?", userID).Find(&rows).Error
	if err := model.DB.Where("user_id = ?", userID).Delete(&model.CanvasHistory{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	for _, row := range rows {
		if row.FilePath != "" {
			_ = os.Remove(row.FilePath)
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
