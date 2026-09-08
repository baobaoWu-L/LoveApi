package model

import (
	"math"
	"strconv"
	"strings"
)

// BasePriceEntry 表示一个模型的价格基准（上游美元价），用于按加价系数重算定价。
// Mode 取值：
//   - "per_token"   按 token 计费（旧版兼容字段）
//   - "per_request" 按次计费（ModelPrice，quot a_type=1）
//   - "tiered"      按上下文分档计费（billing_mode=tiered_expr + billing_expr）
//
// InputUSD/OutputUSD/CacheReadUSD 为每百万 token 的美元价（仅 per_token 使用）；
// PriceUSD 为每次调用的美元价（仅 per_request 使用）；
// BillingExpr 为分档表达式（系数为最终 $/1M 价，仅 tiered 使用）。
// GroupBillingExpr 为指定分组的最终价格覆盖，不再叠加分组倍率。
type BasePriceEntry struct {
	ModelName        string
	Mode             string
	Protocols        []string // ["openai"] 或 ["openai","anthropic"]，用于写 models.endpoints
	InputUSD         float64
	OutputUSD        float64
	CacheReadUSD     float64
	PriceUSD         float64
	BillingExpr      string
	GroupBillingExpr map[string]string
}

func price5(value float64) string {
	return strconv.FormatFloat(math.Round(value*100000)/100000, 'f', 5, 64)
}

func flatBillingExpr(input, output, cacheRead float64) string {
	return flatBillingExprWithCacheCreate(input, output, cacheRead, 0)
}

func flatBillingExprWithCacheCreate(input, output, cacheRead, cacheCreate float64) string {
	parts := []string{"p * " + price5(input), "c * " + price5(output)}
	if cacheRead > 0 {
		parts = append(parts, "cr * "+price5(cacheRead))
	}
	if cacheCreate > 0 {
		parts = append(parts, "cc * "+price5(cacheCreate))
	}
	return `tier("standard", ` + strings.Join(parts, " + ") + ")"
}

func contextBillingExpr(threshold float64, standard, long string) string {
	return "len <= " + price5(threshold) + " ? " + standard + " : " + long
}

func finalTokenPrice(modelName string, protocols []string, input, output, cacheRead float64, groups map[string]string) BasePriceEntry {
	return BasePriceEntry{
		ModelName:        modelName,
		Mode:             "tiered",
		Protocols:        protocols,
		InputUSD:         input,
		OutputUSD:        output,
		CacheReadUSD:     cacheRead,
		BillingExpr:      flatBillingExpr(input, output, cacheRead),
		GroupBillingExpr: groups,
	}
}

func finalTokenPriceWithCacheCreate(modelName string, protocols []string, input, output, cacheRead, cacheCreate float64, groups map[string]string) BasePriceEntry {
	entry := finalTokenPrice(modelName, protocols, input, output, cacheRead, groups)
	entry.BillingExpr = flatBillingExprWithCacheCreate(input, output, cacheRead, cacheCreate)
	return entry
}

func finalRequestPrice(modelName string, protocols []string, price float64) BasePriceEntry {
	return BasePriceEntry{ModelName: modelName, Mode: "per_request", Protocols: protocols, PriceUSD: price}
}

// BasePriceTable contains the final platform prices from the administrator's
// pricing sheet. These values already include the intended group multiplier;
// runtime billing therefore must not multiply them by GroupRatio again.
var BasePriceTable = []BasePriceEntry{
	finalTokenPrice("gpt-5.4", []string{"openai"}, 0.7, 5, 0.07, map[string]string{
		"ChatGpt默认": flatBillingExpr(0.7, 5, 0.07), "ChatGpt尊享": flatBillingExpr(0.95, 6.5, 0.09),
	}),
	finalTokenPrice("gpt-5.4-mini", []string{"openai"}, 0.3, 1.2, 0.03, map[string]string{
		"ChatGpt默认": flatBillingExpr(0.3, 1.2, 0.03), "ChatGpt尊享": flatBillingExpr(0.425, 3.35, 0.043),
	}),
	finalTokenPrice("gpt-5.5", []string{"openai"}, 3, 8, 0.3, map[string]string{
		"ChatGpt默认": flatBillingExpr(3, 8, 0.3), "ChatGpt尊享": flatBillingExpr(3, 11, 0.15),
	}),
	finalTokenPrice("gpt-5.6-luna", []string{"openai"}, 0.06, 0.48, 0.04, map[string]string{
		"ChatGpt默认": flatBillingExpr(0.06, 0.48, 0.04), "ChatGpt尊享": flatBillingExpr(0.08, 0.58, 0.06),
	}),
	finalTokenPrice("gpt-5.6-sol", []string{"openai"}, 3, 8, 0.3, map[string]string{
		"ChatGpt默认": flatBillingExpr(3, 8, 0.3), "ChatGpt尊享": flatBillingExpr(3.5, 11, 0.35),
	}),
	finalTokenPrice("gpt-5.6-terra", []string{"openai"}, 0.6, 3.4, 0.06, map[string]string{
		"ChatGpt默认": flatBillingExpr(0.6, 3.4, 0.06), "ChatGpt尊享": flatBillingExpr(0.8, 5.6, 0.08),
	}),
	finalTokenPrice("gpt-6-astra", []string{"openai"}, 3, 11, 0.4, map[string]string{
		"ChatGpt默认": flatBillingExpr(3, 11, 0.4), "ChatGpt尊享": flatBillingExpr(5, 17, 0.5),
	}),

	finalTokenPriceWithCacheCreate("claude-fable-5", []string{"anthropic", "openai"}, 5, 17, 0.5, 2.175, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(5, 17, 0.5, 2.175), "Claude尊享": flatBillingExprWithCacheCreate(40, 120, 4, 15.5),
	}),
	finalTokenPriceWithCacheCreate("claude-haiku-4-5-20251001", []string{"anthropic", "openai"}, 0.5, 3, 0.03, 0.5, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(0.5, 3, 0.03, 0.5), "Claude尊享": flatBillingExprWithCacheCreate(4, 13, 0.3, 3.5),
	}),
	finalTokenPriceWithCacheCreate("claude-opus-4-5-20251101", []string{"anthropic", "openai"}, 3, 9.5, 0.3, 3, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(3, 9.5, 0.3, 3), "Claude尊享": flatBillingExprWithCacheCreate(12, 60, 3, 16.5),
	}),
	finalTokenPriceWithCacheCreate("claude-opus-4-6", []string{"anthropic", "openai"}, 1.7, 9.5, 0.5, 3.875, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(1.7, 9.5, 0.5, 3.875), "Claude尊享": flatBillingExprWithCacheCreate(12, 55, 4, 14.5),
	}),
	finalTokenPriceWithCacheCreate("claude-opus-4-7", []string{"anthropic", "openai"}, 1.5, 7.5, 0.15, 1.875, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(1.5, 7.5, 0.15, 1.875), "Claude尊享": flatBillingExprWithCacheCreate(12, 55, 3, 14.5),
	}),
	finalTokenPriceWithCacheCreate("claude-opus-4-8", []string{"anthropic", "openai"}, 1.7, 8.5, 0.3, 2.3, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(1.7, 8.5, 0.3, 2.3), "Claude尊享": flatBillingExprWithCacheCreate(12, 55, 4, 14.5),
	}),
	finalTokenPriceWithCacheCreate("claude-opus-5", []string{"anthropic", "openai"}, 1.7, 8.5, 0.3, 2.875, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(1.7, 8.5, 0.3, 2.875), "Claude尊享": flatBillingExprWithCacheCreate(12, 55, 2, 14.5),
	}),
	finalTokenPriceWithCacheCreate("claude-sonnet-4-6", []string{"anthropic", "openai"}, 1.2, 5.5, 0.065, 1.3, map[string]string{
		"Claude默认": flatBillingExprWithCacheCreate(1.2, 5.5, 0.065, 1.3), "Claude尊享": flatBillingExprWithCacheCreate(8, 35, 0.5, 8),
	}),
	finalTokenPrice("claude-sonnet-5", []string{"anthropic", "openai"}, 0.8, 3.5, 0.08, map[string]string{
		"Claude默认": flatBillingExpr(0.8, 3.5, 0.08), "Claude尊享": flatBillingExpr(6, 25, 0.6),
	}),

	finalTokenPrice("gemini-2.5-flash", []string{"gemini", "openai"}, 1.2, 8, 0.12, map[string]string{
		"default": flatBillingExpr(1.2, 8, 0.12),
	}),
	finalTokenPrice("gemini-2.5-pro", []string{"gemini", "openai"}, 1.45, 12, 0, map[string]string{
		"default": flatBillingExpr(1.45, 12, 0),
	}),
	finalTokenPrice("gemini-3-flash-preview", []string{"gemini", "openai"}, 0.95, 4.7, 0.095, map[string]string{
		"default": flatBillingExpr(0.95, 4.7, 0.095),
	}),
	finalTokenPrice("gemini-3.1-flash-lite", []string{"gemini", "openai"}, 0.395, 2.45, 0.058, map[string]string{
		"default": flatBillingExpr(0.395, 2.45, 0.058),
	}),
	finalTokenPrice("gemini-3.1-flash-lite-preview", []string{"gemini", "openai"}, 1.7, 11, 0.35, map[string]string{
		"default": flatBillingExpr(1.7, 11, 0.35),
	}),
	finalTokenPrice("gemini-3.1-pro-preview", []string{"gemini", "openai"}, 5, 21, 0.5, map[string]string{
		"default": contextBillingExpr(200000, `tier("standard", p * 5.00000 + c * 21.00000 + cr * 0.50000)`, `tier("long_context", p * 8.00000 + c * 29.00000 + cr * 0.50000)`),
	}),
	finalTokenPrice("gemini-3.5-flash", []string{"gemini", "openai"}, 2.45, 15.5, 0.425, map[string]string{
		"default": flatBillingExpr(2.45, 15.5, 0.425),
	}),
	finalTokenPrice("gemini-3.6-flash", []string{"gemini", "openai"}, 1.7, 9.5, 0.3, map[string]string{
		"default": flatBillingExpr(1.7, 9.5, 0.3),
	}),
	finalTokenPrice("gemini-3.7-flash", []string{"gemini", "openai"}, 0.95, 3.95, 0.3, map[string]string{
		"default": flatBillingExpr(0.95, 3.95, 0.3),
	}),

	finalTokenPrice("deepseek-v4-flash", []string{"openai", "anthropic"}, 1.3, 3.2, 0.2, map[string]string{
		"国产大模型": flatBillingExpr(1.3, 3.2, 0.2),
	}),
	finalTokenPrice("glm-5.2", []string{"openai"}, 5.5, 15.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(5.5, 15.5, 0.3),
	}),
	finalTokenPrice("glm-5.3", []string{"openai"}, 9, 28.5, 0.9, map[string]string{
		"国产大模型": flatBillingExpr(9, 28.5, 0.9),
	}),
	finalTokenPrice("GLM-5.3", []string{"openai"}, 8.5, 28.5, 0.9, map[string]string{
		"国产大模型": flatBillingExpr(8.5, 28.5, 0.9),
	}),
	finalTokenPrice("glm-5.3-flash", []string{"openai", "anthropic"}, 0.9, 2.9, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(0.9, 2.9, 0.3),
	}),
	finalTokenPrice("kimi-k2.6", []string{"openai"}, 6, 23, 0.5, map[string]string{
		"国产大模型": flatBillingExpr(6, 23, 0.5),
	}),
	finalTokenPrice("kimi-k2.7-code", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(1.5, 3.5, 0.3),
	}),
	finalTokenPrice("kimi-k3", []string{"openai", "anthropic"}, 7.5, 35.5, 0.8, map[string]string{
		"国产大模型": flatBillingExpr(7.5, 35.5, 0.8),
	}),
	finalTokenPrice("MiniMax-M2.7", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(1.5, 3.5, 0.3),
	}),
	finalTokenPrice("MiniMax-M3", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(1.5, 3.5, 0.3),
	}),
	finalTokenPrice("qwen3.6-plus", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": contextBillingExpr(256000, `tier("standard", p * 1.50000 + c * 3.50000 + cr * 0.30000)`, `tier("long_context", p * 8.50000 + c * 48.50000 + cr * 0.30000)`),
	}),
	finalTokenPrice("qwen3.7-max", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(1.5, 3.5, 0.3),
	}),
	finalTokenPrice("qwen3.7-plus", []string{"openai"}, 1.5, 3.5, 0.3, map[string]string{
		"国产大模型": flatBillingExpr(1.5, 3.5, 0.3),
	}),
	finalTokenPrice("qwen3.8-max", []string{"openai"}, 3.8, 11, 0.6, map[string]string{
		"国产大模型": flatBillingExpr(3.8, 11, 0.6),
	}),
	finalTokenPrice("grok-4.5", []string{"openai"}, 2.5, 6.5, 0.7, nil),
	finalTokenPrice("grok-4.6", []string{"openai"}, 2.5, 6.5, 0.7, nil),

	finalRequestPrice("deepseek-v4-flash-c", []string{"openai", "anthropic"}, 0.02),
	finalRequestPrice("deepseek-v4-pro", []string{"openai", "anthropic"}, 0.05),
	finalRequestPrice("deepseek-v4-pro-c", []string{"openai", "anthropic"}, 0.05),
	finalRequestPrice("glm-5.1", []string{"openai", "anthropic"}, 0.02),
	finalRequestPrice("glm-5.2-c", []string{"openai", "anthropic"}, 0.05),
	finalRequestPrice("GLM-5.2", []string{"openai"}, 0.1),
	finalRequestPrice("glm-5.3-c", []string{"openai", "anthropic"}, 0.05),
	finalRequestPrice("grok-imagine-image", []string{"openai"}, 0.3),
	finalRequestPrice("doubao-seedance-2.0", []string{"openai-video"}, 9),
	finalRequestPrice("doubao-seedance-2.0-fast", []string{"openai-video"}, 7),
	finalRequestPrice("doubao-seedance-2-0-260128", []string{"openai-video"}, 9),
	finalRequestPrice("doubao-seedance-2-0-fast-260128", []string{"openai-video"}, 7),
}

// RequestPricingTable contains fixed per-request prices in USD. Keeping this
// table separate from ModelPrice allows the public pricing API and frontend to
// show request tiers without changing the billing storage format.
var RequestPricingTable = map[string]map[string]float64{
	"gpt-image-2": {
		"1k": 0.07000,
		"2k": 0.07000,
		"4k": 0.50000,
	},
	"gemini-3-pro-image": {
		"request": 0.50,
	},
	"gemini-3.1-flash-image": {
		"request": 0.50,
	},
	// Grok Imagine Video：按 480p/720p 区分，输入图按「张」、输入/输出视频按「秒」计费。
	"grok-imagine-video": {
		"480p_input_image":         0.024,
		"480p_input_video_second":  0.12,
		"480p_output_video_second": 0.2,
		"720p_input_image":         0.024,
		"720p_input_video_second":  0.08,
		"720p_output_video_second": 0.3,
	},
}

func requestPricingForModel(modelName string) map[string]float64 {
	for name, prices := range RequestPricingTable {
		if strings.EqualFold(name, modelName) {
			copyPrices := make(map[string]float64, len(prices))
			for tier, price := range prices {
				copyPrices[tier] = price
			}
			return copyPrices
		}
	}
	return nil
}

// RequestPriceUSD returns the base USD price for a fixed-price request model.
// Tiered image models use their "2k" tier as the default pre-consume price;
// the request metadata may apply a more specific tier multiplier later.
func RequestPriceUSD(modelName string) (float64, bool) {
	prices := requestPricingForModel(modelName)
	if len(prices) == 0 {
		return 0, false
	}
	if price, ok := prices["2k"]; ok {
		return price, true
	}
	if price, ok := prices["request"]; ok {
		return price, true
	}
	if price, ok := prices["480p_second"]; ok {
		return price, true
	}
	for _, price := range prices {
		return price, true
	}
	return 0, false
}
