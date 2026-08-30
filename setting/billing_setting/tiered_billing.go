package billing_setting

import (
	"fmt"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio        = "ratio"
	BillingModeTieredExpr   = "tiered_expr"
	BillingModeField        = "billing_mode"
	BillingExprField        = "billing_expr"
	BillingModeByGroupField = "billing_mode_by_group"
	BillingExprByGroupField = "billing_expr_by_group"
)

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
type BillingSetting struct {
	BillingMode map[string]string `json:"billing_mode"`
	BillingExpr map[string]string `json:"billing_expr"`
	// Optional per-group overrides. The inner key is the exact user group name.
	BillingModeByGroup map[string]map[string]string `json:"billing_mode_by_group"`
	BillingExprByGroup map[string]map[string]string `json:"billing_expr_by_group"`
}

var billingSetting = BillingSetting{
	BillingMode:        make(map[string]string),
	BillingExpr:        make(map[string]string),
	BillingModeByGroup: make(map[string]map[string]string),
	BillingExprByGroup: make(map[string]map[string]string),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

// GetBillingModeForGroup returns a group-specific mode when configured and
// falls back to the model-wide mode for backwards compatibility.
func GetBillingModeForGroup(model, group string) string {
	if groups, ok := billingSetting.BillingModeByGroup[model]; ok {
		if mode, ok := groups[group]; ok && mode != "" {
			return mode
		}
	}
	return GetBillingMode(model)
}

// GetBillingExprForGroup returns a group-specific expression when configured
// and falls back to the model-wide expression for backwards compatibility.
func GetBillingExprForGroup(model, group string) (string, bool) {
	if groups, ok := billingSetting.BillingExprByGroup[model]; ok {
		if expr, ok := groups[group]; ok && expr != "" {
			return expr, true
		}
	}
	return GetBillingExpr(model)
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

func GetBillingModeByGroupCopy() map[string]map[string]string {
	result := make(map[string]map[string]string, len(billingSetting.BillingModeByGroup))
	for model, groups := range billingSetting.BillingModeByGroup {
		result[model] = lo.Assign(groups)
	}
	return result
}

func GetBillingExprByGroupCopy() map[string]map[string]string {
	result := make(map[string]map[string]string, len(billingSetting.BillingExprByGroup))
	for model, groups := range billingSetting.BillingExprByGroup {
		result[model] = lo.Assign(groups)
	}
	return result
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 4)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	if modes := GetBillingModeByGroupCopy(); len(modes) > 0 {
		extra[BillingModeByGroupField] = modes
	}
	if exprs := GetBillingExprByGroupCopy(); len(exprs) > 0 {
		extra[BillingExprByGroupField] = exprs
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
