package controller

import (
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

var publicTierPattern = regexp.MustCompile(`(?:(p|c|len)\s*(<=|>=|<|>)\s*([\d.eE+-]+)(?:\s*&&\s*(p|c|len)\s*(<=|>=|<|>)\s*([\d.eE+-]+))?\s*\?\s*)?tier\(["']([^"']*)["'],\s*([^)]+)\)`)
var publicPricePattern = regexp.MustCompile(`(?:^|\+)\s*(p|c|cr|cc|cc1h|img|img_o|ai|ao)\s*\*\s*([\d.eE+-]+)`)

func roundPublicPrice(value float64) float64 {
	if value <= 0 {
		return 0
	}
	return math.Round(value*100000) / 100000
}

func publicNumber(raw string) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || v < 0 {
		return 0
	}
	return roundPublicPrice(v)
}

func publicPricingTiers(expr string) []model.PublicPricingTier {
	if strings.TrimSpace(expr) == "" {
		return nil
	}
	result := make([]model.PublicPricingTier, 0)
	_, expr = billingexpr.ParseExprVersion(strings.TrimSpace(expr))
	if separator := strings.Index(expr, "|||"); separator >= 0 {
		expr = expr[:separator]
	}
	for _, match := range publicTierPattern.FindAllStringSubmatch(expr, -1) {
		tier := model.PublicPricingTier{Label: match[7]}
		if match[1] != "" {
			tier.Conditions = append(tier.Conditions, model.PublicPricingCondition{
				Variable: match[1], Operator: match[2], Value: publicNumber(match[3]),
			})
		}
		if match[4] != "" {
			tier.Conditions = append(tier.Conditions, model.PublicPricingCondition{
				Variable: match[4], Operator: match[5], Value: publicNumber(match[6]),
			})
		}
		for _, price := range publicPricePattern.FindAllStringSubmatch(match[8], -1) {
			value := publicNumber(price[2])
			switch price[1] {
			case "p":
				tier.InputPrice = value
			case "c":
				tier.OutputPrice = value
			case "cr":
				tier.CacheReadPrice = value
			case "cc":
				tier.CacheWritePrice = value
			case "cc1h":
				tier.CacheWrite1hPrice = value
			case "img":
				tier.ImagePrice = value
			case "img_o":
				tier.ImageOutputPrice = value
			case "ai":
				tier.AudioInputPrice = value
			case "ao":
				tier.AudioOutputPrice = value
			}
		}
		result = append(result, tier)
	}
	return result
}

func sanitizePublicPricing(item model.Pricing, group string) model.Pricing {
	expr := item.BillingExpr
	if grouped := item.BillingExprByGroup[group]; strings.TrimSpace(grouped) != "" {
		expr = grouped
	}
	item.PublicPricingTiers = publicPricingTiers(expr)
	item.PricingGroup = group
	item.BillingMode = ""
	item.BillingExpr = ""
	item.BillingModeByGroup = nil
	item.BillingExprByGroup = nil
	return item
}

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	var group string
	isAdmin := false
	if exists {
		id, ok := userId.(int)
		if !ok {
			id = 0
		}
		user, err := model.GetUserCache(id)
		if err == nil {
			group = user.Group
			isAdmin = model.IsAdmin(id)
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	role := common.RoleCommonUser
	if isAdmin {
		role = common.RoleAdminUser
	}
	usableGroup = service.GetUserUsableGroupsForRole(group, role)
	if !isAdmin {
		pricing = filterPricingByUsableGroups(pricing, usableGroup)
	}
	if !isAdmin {
		for i := range pricing {
			pricing[i] = sanitizePublicPricing(pricing[i], group)
		}
	}
	for configuredGroup := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[configuredGroup]; !ok {
			delete(groupRatio, configuredGroup)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(group),
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
