package model

import "strings"

// BasePriceEntry 表示一个模型的价格基准（上游美元价），用于按加价系数重算定价。
// Mode 取值：
//   - "per_token"   按 token 计费（ModelRatio + CompletionRatio + CacheRatio）
//   - "per_request" 按次计费（ModelPrice，quot a_type=1）
//   - "tiered"      按上下文分档计费（billing_mode=tiered_expr + billing_expr）
//
// InputUSD/OutputUSD/CacheReadUSD 为每百万 token 的美元价（仅 per_token 使用）；
// PriceUSD 为每次调用的美元价（仅 per_request 使用）；
// BillingExpr 为分档表达式（系数为真实 $/1M 价，构建时已含加价系数，仅 tiered 使用）。
type BasePriceEntry struct {
	ModelName    string
	Mode         string
	Protocols    []string // ["openai"] 或 ["openai","anthropic"]，用于写 models.endpoints
	InputUSD     float64
	OutputUSD    float64
	CacheReadUSD float64
	PriceUSD     float64
	BillingExpr  string
}

// BasePriceTable 国产大模型价格基准表（上游美元价，未乘加价系数）。
// 加价系数（ModelPriceMarkupFactor，默认 1.25）由 RecomputeModelPrices 统一应用。
var BasePriceTable = []BasePriceEntry{
	// ── GLM 系列 ──────────────────────────────────────────────
	// 注意：上游对模型名大小写不敏感，大写 GLM-5.2 会被能力表归并为小写 glm-5.2，
	// 无法作为独立模型被路由(否则「显示但调用失败」)，故仅保留小写按量 glm-5.2。
	{ModelName: "glm-5.2", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 5.0, OutputUSD: 15.0},
	{ModelName: "glm-5.2-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.03},
	{ModelName: "glm-5.3", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 8.0, OutputUSD: 28.0},
	{ModelName: "glm-5.3-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.03},
	{ModelName: "glm-5.3-flash", Mode: "per_token", Protocols: []string{"openai", "anthropic"}, InputUSD: 0.8, OutputUSD: 2.8},

	// ── Kimi 系列 ────────────────────────────────────────────
	{ModelName: "kimi-k2.6", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 5.0, OutputUSD: 20.0},
	{ModelName: "kimi-k2.7", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 5.0, OutputUSD: 20.0, CacheReadUSD: 0.3},
	{ModelName: "kimi-k2.7-code", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 1.0, OutputUSD: 3.0},
	{ModelName: "kimi-k3", Mode: "per_token", Protocols: []string{"openai", "anthropic"}, InputUSD: 7.0, OutputUSD: 35.0},

	// ── DeepSeek 系列 ────────────────────────────────────────
	{ModelName: "deepseek-v4-pro", Mode: "per_request", Protocols: []string{"openai"}, PriceUSD: 0.03},
	{ModelName: "deepseek-v4-pro-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.03},
	{ModelName: "deepseek-v4-flash", Mode: "per_token", Protocols: []string{"openai", "anthropic"}, InputUSD: 1.0, OutputUSD: 3.0, CacheReadUSD: 0},
	{ModelName: "deepseek-v4-flash-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.01},

	// ── Qwen 系列 ────────────────────────────────────────────
	// 上下文分档：(0,256k] 输入$1/输出$3；[256k,1000k] 输入$8/输出$48；缓存读$0.1。
	// BillingExpr 系数为真实 $/1M，**已乘加价系数 ×1.25**（输入1.25/3.75/0.125；10/60/0.125）。
	{ModelName: "qwen3.6-plus", Mode: "tiered", Protocols: []string{"openai"},
		BillingExpr: "len <= 256000 ? tier(\"(0,256k]\", p * 1.25 + c * 3.75 + cr * 0.125) : tier(\"(256k,1000k]\", p * 10 + c * 60 + cr * 0.125)"},
	{ModelName: "qwen3.7-max", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 1.0, OutputUSD: 3.0},
	{ModelName: "qwen3.7-plus", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 1.0, OutputUSD: 3.0},
	{ModelName: "qwen3.8-max", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 3.6, OutputUSD: 10.8},

	// ── MiniMax 系列 ─────────────────────────────────────────
	{ModelName: "MiniMax-M2.7", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 1.0, OutputUSD: 3.0, CacheReadUSD: 0},
	{ModelName: "MiniMax-M3", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 1.0, OutputUSD: 3.0, CacheReadUSD: 0},
	// ── 上游模型广场补充（页面美元价，重算时统一乘 1.25） ───────
	{ModelName: "claude-fable-5", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 3, OutputUSD: 15},
	{ModelName: "claude-haiku-4-5-20251001", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 0.3, OutputUSD: 1.5},
	{ModelName: "claude-opus-4-5-20251101", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "claude-opus-4-6", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "claude-opus-4-7", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "claude-opus-4-8", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "claude-opus-5", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "claude-sonnet-4-6", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 0.9, OutputUSD: 4.5},
	{ModelName: "claude-sonnet-5", Mode: "per_token", Protocols: []string{"anthropic", "openai"}, InputUSD: 0.6, OutputUSD: 3},
	{ModelName: "gemini-2.5-flash", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 0.9, OutputUSD: 7.5},
	{ModelName: "gemini-2.5-pro", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 1.25, OutputUSD: 10},
	{ModelName: "gemini-3-flash-preview", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 0.75, OutputUSD: 4.5},
	{ModelName: "gemini-3.1-flash-lite", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 0.375, OutputUSD: 2.25},
	{ModelName: "gemini-3.1-flash-lite-preview", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 1.5, OutputUSD: 9},
	{ModelName: "gemini-3.1-pro-preview", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 3, OutputUSD: 18},
	{ModelName: "gemini-3.5-flash", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 2.25, OutputUSD: 13.5},
	{ModelName: "gemini-3.6-flash", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 1.5, OutputUSD: 7.5},
	{ModelName: "gemini-3.7-flash", Mode: "per_token", Protocols: []string{"gemini", "openai"}, InputUSD: 0.75, OutputUSD: 3.75},
	{ModelName: "glm-5.1", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.01},
	{ModelName: "glm-5.2-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.03},
	{ModelName: "glm-5.3-c", Mode: "per_request", Protocols: []string{"openai", "anthropic"}, PriceUSD: 0.03},
	{ModelName: "grok-4.5", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 2, OutputUSD: 6},
	{ModelName: "grok-4.6", Mode: "per_token", Protocols: []string{"openai"}, InputUSD: 2, OutputUSD: 6},
	{ModelName: "grok-imagine-image", Mode: "per_request", Protocols: []string{"openai"}, PriceUSD: 0.30},

	// ── 视频模型（上游公开美元起始价，按次计费） ───────────────
	{ModelName: "doubao-seedance-2.0", Mode: "per_request", Protocols: []string{"openai-video"}, PriceUSD: 9.0},
	{ModelName: "doubao-seedance-2.0-fast", Mode: "per_request", Protocols: []string{"openai-video"}, PriceUSD: 7.0},
	{ModelName: "doubao-seedance-2-0-260128", Mode: "per_request", Protocols: []string{"openai-video"}, PriceUSD: 9.0},
	{ModelName: "doubao-seedance-2-0-fast-260128", Mode: "per_request", Protocols: []string{"openai-video"}, PriceUSD: 7.0},
}

// RequestPricingTable contains fixed per-request prices in USD. Keeping this
// table separate from ModelPrice allows the public pricing API and frontend to
// show request tiers without changing the billing storage format.
var RequestPricingTable = map[string]map[string]float64{
	"gpt-image-2": {
		"1k": 0.07,
		"2k": 0.07,
		"4k": 0.50,
	},
	"gemini-3-pro-image": {
		"request": 0.50,
	},
	"gemini-3.1-flash-image": {
		"request": 0.50,
	},
	// Grok Imagine Video：按 480p/720p 区分，输入图按「张」、输入/输出视频按「秒」计费。
	"grok-imagine-video": {
		"480p_input_image":        0.024,
		"480p_input_video_second": 0.12,
		"480p_output_video_second": 0.2,
		"720p_input_image":        0.024,
		"720p_input_video_second": 0.08,
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
