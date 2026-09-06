package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// redemptionRequest 服务于 Add/UpdateRedemption 的请求绑定。
// ExpiredTime 使用 json.RawMessage 以同时兼容前端仍可能提交的 unix 秒数字
// 与切换后的 RFC3339 字符串，0 / 空 表示不过期（映射为 nil）。
type redemptionRequest struct {
	Id          int             `json:"id"`
	Name        string          `json:"name"`
	Quota       int             `json:"quota"`
	Count       int             `json:"count"`
	Status      int             `json:"status"`
	ExpiredTime json.RawMessage `json:"expired_time"`
}

// parseExpiredTime 将请求中的 expired_time 解析为 *time.Time。
// nil 表示不过期。兼容 unix 秒数字与 RFC3339 字符串两种格式。
func parseExpiredTime(raw json.RawMessage) (*time.Time, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	// 优先按 unix 秒数字解析
	var sec int64
	if err := common.Unmarshal(raw, &sec); err == nil {
		if sec <= 0 {
			return nil, nil
		}
		t := time.Unix(sec, 0)
		return &t, nil
	}
	// 其次按 RFC3339 字符串解析
	var s string
	if err := common.Unmarshal(raw, &s); err == nil {
		if s == "" {
			return nil, nil
		}
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			return nil, errors.New("无效的过期时间")
		}
		return &t, nil
	}
	return nil, errors.New("无效的过期时间")
}

func GetAllRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func SearchRedemptions(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.SearchRedemptions(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
	return
}

func AddRedemption(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
		return
	}

	req := redemptionRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(req.Name) == 0 || utf8.RuneCountInString(req.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionNameLength)
		return
	}
	if req.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountPositive)
		return
	}
	if req.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountMax)
		return
	}
	expired, err := parseExpiredTime(req.ExpiredTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if valid, msg := validateExpiredTime(c, expired); !valid {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}
	var keys []string
	for i := 0; i < req.Count; i++ {
		key := common.GetUUID()
		cleanRedemption := model.Redemption{
			UserId:      c.GetInt("id"),
			Name:        req.Name,
			Key:         key,
			CreatedTime: time.Now(),
			Quota:       req.Quota,
			ExpiredTime: expired,
		}
		err = cleanRedemption.Insert()
		if err != nil {
			common.SysError("failed to insert redemption: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgRedemptionCreateFailed),
				"data":    keys,
			})
			return
		}
		keys = append(keys, key)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
	return
}

func DeleteRedemption(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only")
	req := redemptionRequest{}
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cleanRedemption, err := model.GetRedemptionById(req.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		expired, err := parseExpiredTime(req.ExpiredTime)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if valid, msg := validateExpiredTime(c, expired); !valid {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
			return
		}
		// If you add more fields, please also update redemption.Update()
		cleanRedemption.Name = req.Name
		cleanRedemption.Quota = req.Quota
		cleanRedemption.ExpiredTime = expired
	}
	if statusOnly != "" {
		cleanRedemption.Status = req.Status
	}
	err = cleanRedemption.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanRedemption,
	})
	return
}

func DeleteInvalidRedemption(c *gin.Context) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

func validateExpiredTime(c *gin.Context, expired *time.Time) (bool, string) {
	if expired != nil && expired.Before(time.Now()) {
		return false, i18n.T(c, i18n.MsgRedemptionExpireTimeInvalid)
	}
	return true, ""
}
