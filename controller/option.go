package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var completionRatioMetaOptionKeys = []string{
	"ModelPrice",
	"ModelRatio",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
}

func isPaymentComplianceOptionKey(key string) bool {
	return strings.HasPrefix(key, "payment_setting.compliance_")
}

func isPositiveOptionValue(value string) bool {
	intValue, err := strconv.Atoi(strings.TrimSpace(value))
	if err == nil {
		return intValue > 0
	}
	floatValue, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	return err == nil && floatValue > 0
}

func isVisiblePublicKeyOption(key string) bool {
	switch key {
	case "WaffoPancakeWebhookPublicKey", "WaffoPancakeWebhookTestKey":
		return true
	default:
		return false
	}
}

func validateNumericGroupMap(raw, field string) error {
	var values map[string]float64
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("%s 必须是 JSON 对象: %w", field, err)
	}
	for name, ratio := range values {
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("%s 分组名不能为空", field)
		}
		if ratio < 0 {
			return fmt.Errorf("%s 分组 %s 倍率不能为负数", field, name)
		}
	}
	return nil
}

func validateUserUsableGroups(raw string) error {
	var values map[string]string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("UserUsableGroups 必须是 JSON 对象: %w", err)
	}
	for name := range values {
		if strings.TrimSpace(name) == "" {
			return errors.New("UserUsableGroups 分组名不能为空")
		}
	}
	return nil
}

func validateGroupGroupRatio(raw string) error {
	var values map[string]map[string]float64
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("GroupGroupRatio 必须是嵌套 JSON 对象: %w", err)
	}
	for userGroup, overrides := range values {
		if strings.TrimSpace(userGroup) == "" {
			return errors.New("GroupGroupRatio 用户分组名不能为空")
		}
		for targetGroup, ratio := range overrides {
			if strings.TrimSpace(targetGroup) == "" {
				return errors.New("GroupGroupRatio 目标分组名不能为空")
			}
			if ratio < 0 {
				return fmt.Errorf("GroupGroupRatio 分组 %s -> %s 倍率不能为负数", userGroup, targetGroup)
			}
		}
	}
	return nil
}

func validateAutoGroups(raw string) error {
	var values []string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("AutoGroups 必须是 JSON 字符串数组: %w", err)
	}
	seen := make(map[string]struct{}, len(values))
	for _, group := range values {
		group = strings.TrimSpace(group)
		if group == "" {
			return errors.New("AutoGroups 分组名不能为空")
		}
		if group == "auto" {
			return errors.New("AutoGroups 不能包含 auto")
		}
		if _, exists := seen[group]; exists {
			return fmt.Errorf("AutoGroups 分组重复: %s", group)
		}
		seen[group] = struct{}{}
	}
	return nil
}

func validateSpecialUsableGroups(raw string) error {
	var values map[string]map[string]string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("特殊可用分组规则必须是嵌套 JSON 对象: %w", err)
	}
	for userGroup, rules := range values {
		if strings.TrimSpace(userGroup) == "" {
			return errors.New("特殊可用分组规则的用户分组名不能为空")
		}
		for rawGroup := range rules {
			group := rawGroup
			if strings.HasPrefix(group, "+:") || strings.HasPrefix(group, "-:") {
				group = group[2:]
			}
			if strings.TrimSpace(group) == "" {
				return errors.New("特殊可用分组规则的目标分组名不能为空")
			}
		}
	}
	return nil
}

func validateBillingExpressions(raw string, grouped bool) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	if grouped {
		var values map[string]map[string]string
		if err := common.UnmarshalJsonStr(raw, &values); err != nil {
			return fmt.Errorf("分组计费表达式必须是 JSON 对象: %w", err)
		}
		for modelName, groups := range values {
			for groupName, expr := range groups {
				if strings.TrimSpace(expr) == "" {
					continue
				}
				if err := billing_setting.SmokeTestExpr(expr); err != nil {
					return fmt.Errorf("模型 %s 分组 %s 表达式无效: %w", modelName, groupName, err)
				}
			}
		}
		return nil
	}
	var values map[string]string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return fmt.Errorf("计费表达式必须是 JSON 对象: %w", err)
	}
	for modelName, expr := range values {
		if strings.TrimSpace(expr) == "" {
			continue
		}
		if err := billing_setting.SmokeTestExpr(expr); err != nil {
			return fmt.Errorf("模型 %s 表达式无效: %w", modelName, err)
		}
	}
	return nil
}

func collectModelNamesFromOptionValue(raw string, modelNames map[string]struct{}) {
	if strings.TrimSpace(raw) == "" {
		return
	}

	var parsed map[string]any
	if err := common.UnmarshalJsonStr(raw, &parsed); err != nil {
		return
	}

	for modelName := range parsed {
		modelNames[modelName] = struct{}{}
	}
}

func buildCompletionRatioMetaValue(optionValues map[string]string) string {
	modelNames := make(map[string]struct{})
	for _, key := range completionRatioMetaOptionKeys {
		collectModelNamesFromOptionValue(optionValues[key], modelNames)
	}

	meta := make(map[string]ratio_setting.CompletionRatioInfo, len(modelNames))
	for modelName := range modelNames {
		meta[modelName] = ratio_setting.GetCompletionRatioInfo(modelName)
	}

	jsonBytes, err := common.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func GetOptions(c *gin.Context) {
	var options []*model.Option
	optionValues := make(map[string]string)
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		value := common.Interface2String(v)
		isSensitiveKey := strings.HasSuffix(k, "Token") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key")
		if isSensitiveKey && !isVisiblePublicKeyOption(k) {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: value,
		})
		for _, optionKey := range completionRatioMetaOptionKeys {
			if optionKey == k {
				optionValues[k] = value
				break
			}
		}
	}
	common.OptionMapRWMutex.Unlock()
	options = append(options, &model.Option{
		Key:   "CompletionRatioMeta",
		Value: buildCompletionRatioMetaValue(optionValues),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := common.DecodeJson(c.Request.Body, &option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	switch option.Key {
	case "QuotaForInviter", "QuotaForInvitee":
		if isPositiveOptionValue(option.Value.(string)) && !operation_setting.IsPaymentComplianceConfirmed() {
			common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
			return
		}
	default:
		if isPaymentComplianceOptionKey(option.Key) {
			common.ApiErrorMsg(c, "合规确认字段不允许通过通用设置接口修改")
			return
		}
	}
	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return
		}
	case "theme.frontend":
		if option.Value != "default" && option.Value != "classic" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的主题值，可选值：default（新版前端）、classic（经典前端）",
			})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "TopupGroupRatio":
		err = validateNumericGroupMap(option.Value.(string), "TopupGroupRatio")
	case "UserUsableGroups":
		err = validateUserUsableGroups(option.Value.(string))
	case "GroupGroupRatio":
		err = validateGroupGroupRatio(option.Value.(string))
	case "AutoGroups":
		err = validateAutoGroups(option.Value.(string))
	case "group_ratio_setting.group_special_usable_group":
		err = validateSpecialUsableGroups(option.Value.(string))
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	switch option.Key {
	case "billing_setting.billing_expr":
		if err = validateBillingExpressions(option.Value.(string), false); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	case "billing_setting.billing_expr_by_group":
		if err = validateBillingExpressions(option.Value.(string), true); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "缓存创建倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
