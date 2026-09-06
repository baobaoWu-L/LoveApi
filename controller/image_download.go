package controller

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ImageDownload 代理下载跨域图片。
// 生成图历史里保存的是上游 URL（如 superaiapi.com），浏览器直接 <a download> 会被
// 跨域限制忽略并打开新标签页；这里由服务端 fetch 该 URL 并以 attachment 返回，
// 前端即可直接保存。服务端请求不受浏览器 CORS 限制。
func ImageDownload(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "url is required"})
		return
	}
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid url scheme"})
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, rawURL, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "upstream status " + http.StatusText(resp.StatusCode)})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	// 依据内容类型推断扩展名，方便保存时带上正确后缀
	ext := ".png"
	if strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg") {
		ext = ".jpg"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	}
	c.Header("Content-Disposition", `attachment; filename="generated-image`+ext+`"`)
	c.Header("Content-Type", contentType)
	c.DataFromReader(http.StatusOK, resp.ContentLength, contentType, resp.Body, nil)
}
