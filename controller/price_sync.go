package controller

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// markupFactor 读取「自动抬价系数」（options: ModelPriceMarkupFactor），默认 1.25。
// 该系数会在同步上游价格时，把所有国产模型的上游美元价统一上浮。
func markupFactor() float64 {
	raw := common.OptionMap["ModelPriceMarkupFactor"]
	if v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil && v > 0 {
		return v
	}
	return 1.25
}

// protectedPriceModel keeps the explicitly frozen ChatGPT and image2 prices
// out of an upstream-wide refresh.  Other models may be refreshed normally.
func protectedPriceModel(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "gpt-image-2" || lower == "gpt-image-1" {
		return true
	}
	return strings.HasPrefix(lower, "gpt-") || strings.HasPrefix(lower, "chatgpt-")
}

// endpointsJSON 根据协议列表生成 models.endpoints 字段的 JSON 字符串。
// 仅 openai：{"openai":"/v1/chat/completions"}；同时 anthropic：再补 /v1/messages。
func endpointsJSON(protocols []string) string {
	m := make(map[string]string)
	for _, p := range protocols {
		switch p {
		case "anthropic":
			m["anthropic"] = "/v1/messages"
		case "openai":
			m["openai"] = "/v1/chat/completions"
		case "openai-video":
			m["openai-video"] = "/v1/videos"
		}
	}
	bytes, _ := common.Marshal(m)
	return string(bytes)
}

// round5 keeps stored prices stable and prevents values such as 1.659999.
func round5(v float64) float64 {
	return math.Round(v*1e5) / 1e5
}

var billingPriceCoefficientPattern = regexp.MustCompile(`\b(p|c|cr|cc|cc1h|img|img_o|ai|ao)\s*\*\s*([0-9]+(?:\.[0-9]+)?)`)

// scaleBillingExpr applies the upstream markup only to price coefficients,
// never to context thresholds or other numeric request conditions.
func scaleBillingExpr(expr string, markup float64) string {
	return billingPriceCoefficientPattern.ReplaceAllStringFunc(expr, func(match string) string {
		parts := billingPriceCoefficientPattern.FindStringSubmatch(match)
		value, err := strconv.ParseFloat(parts[2], 64)
		if err != nil {
			return match
		}
		return strings.Replace(match, parts[2], strconv.FormatFloat(round5(value*markup), 'f', 5, 64), 1)
	})
}

// RecomputeModelPrices 按加价系数（ModelPriceMarkupFactor）重算国产大模型价格。
// 只更新 BasePriceTable 覆盖的模型，其余模型（含 gemini 分档、claude 等）原值保留。
// 这是「模型和价格自动同步上游 → 价格自动抬高」的手动触发入口。
func RecomputeModelPrices(c *gin.Context) {
	markup := markupFactor()

	// 取全量 map（写回必须合并，否则会清空其它模型配置）
	mr := ratio_setting.GetModelRatioCopy()
	mp := ratio_setting.GetModelPriceCopy()
	cm := ratio_setting.GetCompletionRatioCopy()
	cr := ratio_setting.GetCacheRatioCopy()
	ccr := ratio_setting.GetCreateCacheRatioCopy()
	bm := billing_setting.GetBillingModeCopy()
	be := billing_setting.GetBillingExprCopy()
	bmg := billing_setting.GetBillingModeByGroupCopy()
	beg := billing_setting.GetBillingExprByGroupCopy()

	modelsURL, _ := getUpstreamURLs(c.Query("locale"))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	var upstream upstreamEnvelope[upstreamModel]
	if err := fetchJSON(ctx, modelsURL, &upstream); err != nil {
		c.JSON(502, gin.H{"success": false, "message": "获取上游价格失败: " + err.Error()})
		return
	}

	upstreamUpdated := 0
	basePriceNames := make(map[string]struct{}, len(model.BasePriceTable))
	for _, entry := range model.BasePriceTable {
		basePriceNames[strings.ToLower(entry.ModelName)] = struct{}{}
	}
	for _, item := range upstream.Data {
		if protectedPriceModel(item.ModelName) {
			continue
		}
		// Explicit entries are sourced from the upstream pricing page and are
		// applied below; do not let the metadata feed (which can lag or use a
		// different billing unit) overwrite them.
		if _, ok := basePriceNames[strings.ToLower(item.ModelName)]; ok {
			continue
		}
		if item.ModelName == "" || item.PricePerMInput == nil || *item.PricePerMInput < 0 {
			continue
		}
		input := *item.PricePerMInput
		mr[item.ModelName] = round5(input * markup / 2)
		delete(mp, item.ModelName)
		if input > 0 && item.PricePerMOutput != nil {
			cm[item.ModelName] = round5(*item.PricePerMOutput / input)
		} else {
			delete(cm, item.ModelName)
		}
		if input > 0 && item.PricePerMCacheRead != nil {
			cr[item.ModelName] = round5(*item.PricePerMCacheRead / input)
		} else {
			delete(cr, item.ModelName)
		}
		if input > 0 && item.PricePerMCacheWrite != nil {
			ccr[item.ModelName] = round5(*item.PricePerMCacheWrite / input)
		} else {
			delete(ccr, item.ModelName)
		}
		upstreamUpdated++
	}

	updated := 0
	for _, e := range model.BasePriceTable {
		switch e.Mode {
		case "per_token":
			inputUSD := e.InputUSD * markup
			mr[e.ModelName] = round5(inputUSD / 2)
			cm[e.ModelName] = round5(e.OutputUSD / e.InputUSD)
			cr[e.ModelName] = round5(e.CacheReadUSD / e.InputUSD)
			delete(mp, e.ModelName)
		case "per_request":
			mp[e.ModelName] = round5(e.PriceUSD * markup)
			delete(mr, e.ModelName)
			delete(cm, e.ModelName)
			delete(cr, e.ModelName)
		case "tiered":
			bm[e.ModelName] = "tiered_expr"
			be[e.ModelName] = e.BillingExpr
			if len(e.GroupBillingExpr) > 0 {
				groupModes := make(map[string]string, len(e.GroupBillingExpr))
				groupExprs := make(map[string]string, len(e.GroupBillingExpr))
				for group, expr := range e.GroupBillingExpr {
					groupModes[group] = billing_setting.BillingModeTieredExpr
					groupExprs[group] = expr
				}
				bmg[e.ModelName] = groupModes
				beg[e.ModelName] = groupExprs
			} else {
				delete(bmg, e.ModelName)
				delete(beg, e.ModelName)
			}
			delete(mp, e.ModelName)
			delete(mr, e.ModelName)
			delete(cm, e.ModelName)
			delete(cr, e.ModelName)
			delete(ccr, e.ModelName)
		default:
			continue
		}
		_ = model.DB.Model(&model.Model{}).
			Where("model_name = ?", e.ModelName).
			Update("endpoints", endpointsJSON(e.Protocols))
		updated++
	}

	// 合并写回（UpdateOption 内部会落库 + 更新内存 + 失效缓存）
	_ = model.UpdateOption("ModelRatio", string(mustMarshal(mr)))
	_ = model.UpdateOption("ModelPrice", string(mustMarshal(mp)))
	_ = model.UpdateOption("CompletionRatio", string(mustMarshal(cm)))
	_ = model.UpdateOption("CacheRatio", string(mustMarshal(cr)))
	_ = model.UpdateOption("CreateCacheRatio", string(mustMarshal(ccr)))
	_ = model.UpdateOption("billing_setting.billing_mode", string(mustMarshal(bm)))
	_ = model.UpdateOption("billing_setting.billing_expr", string(mustMarshal(be)))
	_ = model.UpdateOption("billing_setting.billing_mode_by_group", string(mustMarshal(bmg)))
	_ = model.UpdateOption("billing_setting.billing_expr_by_group", string(mustMarshal(beg)))

	// 立即刷新定价缓存（UpdateOption 对 billing_setting 已失效，这里统一兜底）
	model.InvalidatePricingCache()
	ratio_setting.InvalidateExposedDataCache()

	c.JSON(200, gin.H{
		"success":          true,
		"updated":          updated + upstreamUpdated,
		"upstream_updated": upstreamUpdated,
		"custom_updated":   updated,
		"markup":           markup,
		"source":           modelsURL,
	})
}

func mustMarshal(v any) []byte {
	b, err := common.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}

// superAIPricingItem is the public /api/pricing format exposed by SuperAI.
// Ratios are relative billing coefficients; model_price is a fixed per-request
// price when quota_type is 1.
type superAIPricingItem struct {
	ModelName            string   `json:"model_name"`
	QuotaType            int      `json:"quota_type"`
	ModelRatio           float64  `json:"model_ratio"`
	ModelPrice           float64  `json:"model_price"`
	CompletionRatio      float64  `json:"completion_ratio"`
	CacheRatio           *float64 `json:"cache_ratio"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio"`
	ImageRatio           *float64 `json:"image_ratio"`
	AudioRatio           *float64 `json:"audio_ratio"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio"`
	BillingMode          string   `json:"billing_mode"`
	BillingExpr          string   `json:"billing_expr"`
}

// resolveSuperAIPricingSource prefers an explicitly configured token, then a
// matching SuperAI channel key. The token is never returned to the client.
func resolveSuperAIPricingSource() (string, string, error) {
	pricingURL := strings.TrimRight(common.GetEnvOrDefaultString(
		"SUPERAI_PRICING_API_URL", "https://superaiapi.com/api/pricing"), "/")
	token := strings.TrimSpace(common.GetEnvOrDefaultString("SUPERAI_PRICING_API_TOKEN", ""))
	if token != "" {
		return pricingURL, token, nil
	}

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return "", "", err
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled || channel.ChannelInfo.IsMultiKey {
			continue
		}
		base := strings.TrimRight(channel.GetBaseURL(), "/")
		lowerBase := strings.ToLower(base)
		if !strings.Contains(lowerBase, "superaiapi.com") {
			continue
		}
		base = strings.TrimSuffix(base, "/v1")
		key, _, apiErr := channel.GetNextEnabledKey()
		if apiErr == nil && strings.TrimSpace(key) != "" {
			return base + "/api/pricing", strings.TrimSpace(key), nil
		}
	}

	// /api/pricing is currently public, so an empty token remains a useful
	// fallback while allowing private deployments to require configuration.
	return pricingURL, "", nil
}

func fetchSuperAIPricing(ctx context.Context, pricingURL, token string) ([]superAIPricingItem, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pricingURL, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := newHTTPClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upstream returned %s", resp.Status)
	}
	var envelope struct {
		Success bool                 `json:"success"`
		Message string               `json:"message"`
		Data    []superAIPricingItem `json:"data"`
	}
	if err := common.DecodeJson(resp.Body, &envelope); err != nil {
		return nil, err
	}
	if !envelope.Success {
		return nil, fmt.Errorf("upstream pricing failed: %s", envelope.Message)
	}
	if len(envelope.Data) == 0 {
		return nil, errors.New("upstream returned no pricing models")
	}
	return envelope.Data, nil
}

// SyncSuperAIPricing refreshes local model prices from SuperAI's /api/pricing
// endpoint. It is admin-only and applies the configured markup while keeping
// completion/cache ratios and group multipliers unchanged.
func SyncSuperAIPricing(c *gin.Context) {
	pricingURL, token, err := resolveSuperAIPricingSource()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()
	items, err := fetchSuperAIPricing(ctx, pricingURL, token)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "获取上游价格失败: " + err.Error()})
		return
	}

	markup := markupFactor()
	mr := ratio_setting.GetModelRatioCopy()
	mp := ratio_setting.GetModelPriceCopy()
	cm := ratio_setting.GetCompletionRatioCopy()
	cr := ratio_setting.GetCacheRatioCopy()
	ccr := ratio_setting.GetCreateCacheRatioCopy()
	ir := ratio_setting.GetImageRatioCopy()
	ar := ratio_setting.GetAudioRatioCopy()
	acr := ratio_setting.GetAudioCompletionRatioCopy()
	bm := billing_setting.GetBillingModeCopy()
	be := billing_setting.GetBillingExprCopy()

	updated := 0
	for _, item := range items {
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			continue
		}
		if item.QuotaType == 1 {
			mp[name] = round5(item.ModelPrice * markup)
			delete(mr, name)
			delete(cm, name)
		} else {
			mr[name] = round5(item.ModelRatio * markup)
			cm[name] = round5(item.CompletionRatio)
			delete(mp, name)
		}
		if item.CacheRatio != nil {
			cr[name] = round5(*item.CacheRatio)
		} else {
			delete(cr, name)
		}
		if item.CreateCacheRatio != nil {
			ccr[name] = round5(*item.CreateCacheRatio)
		} else {
			delete(ccr, name)
		}
		if item.ImageRatio != nil {
			ir[name] = round5(*item.ImageRatio * markup)
		}
		if item.AudioRatio != nil {
			ar[name] = round5(*item.AudioRatio * markup)
		}
		if item.AudioCompletionRatio != nil {
			acr[name] = round5(*item.AudioCompletionRatio)
		}
		if strings.TrimSpace(item.BillingMode) != "" {
			bm[name] = item.BillingMode
		}
		if strings.TrimSpace(item.BillingExpr) != "" {
			be[name] = scaleBillingExpr(item.BillingExpr, markup)
		}
		updated++
	}

	_ = model.UpdateOption("ModelRatio", string(mustMarshal(mr)))
	_ = model.UpdateOption("ModelPrice", string(mustMarshal(mp)))
	_ = model.UpdateOption("CompletionRatio", string(mustMarshal(cm)))
	_ = model.UpdateOption("CacheRatio", string(mustMarshal(cr)))
	_ = model.UpdateOption("CreateCacheRatio", string(mustMarshal(ccr)))
	_ = model.UpdateOption("ImageRatio", string(mustMarshal(ir)))
	_ = model.UpdateOption("AudioRatio", string(mustMarshal(ar)))
	_ = model.UpdateOption("AudioCompletionRatio", string(mustMarshal(acr)))
	_ = model.UpdateOption("billing_setting.billing_mode", string(mustMarshal(bm)))
	_ = model.UpdateOption("billing_setting.billing_expr", string(mustMarshal(be)))
	model.InvalidatePricingCache()
	ratio_setting.InvalidateExposedDataCache()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"updated": updated,
			"markup":  markup,
			"source":  pricingURL,
		},
	})
}
