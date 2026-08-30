package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// NormalizeGroupName keeps legacy channel/token clients compatible with the
// consolidated group configuration. Historical deployments exposed provider
// groups such as MINIMAX; those names now belong to 国产大模型.
func NormalizeGroupName(group string) string {
	trimmed := strings.TrimSpace(group)
	if strings.EqualFold(trimmed, "default") {
		return "default"
	}
	switch strings.ToUpper(trimmed) {
	case "MINIMAX", "MINMAX", "DEEPSEEK", "QWEN", "KIMI", "GLM":
		return "国产大模型"
	default:
		return trimmed
	}
}

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	groupsCopy = normalizeGroupKeys(groupsCopy)
	if strings.EqualFold(userGroup, "default") {
		userGroup = "default"
	}
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			// 处理特殊可用分组
			for specialGroup, desc := range specialSettings {
				if strings.HasPrefix(specialGroup, "-:") {
					// 移除分组
					groupToRemove := strings.TrimPrefix(specialGroup, "-:")
					delete(groupsCopy, groupToRemove)
				} else if strings.HasPrefix(specialGroup, "+:") {
					// 添加分组
					groupToAdd := strings.TrimPrefix(specialGroup, "+:")
					groupsCopy[groupToAdd] = desc
				} else {
					// 直接添加分组
					groupsCopy[specialGroup] = desc
				}
			}
		}
		// 如果userGroup不在UserUsableGroups中，返回UserUsableGroups + userGroup
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	return groupsCopy
}

// GetUserUsableGroupsForRole keeps ordinary users subject to the configured
// allow-list while administrators can always select every configured group.
func GetUserUsableGroupsForRole(userGroup string, role int) map[string]string {
	if role < common.RoleAdminUser {
		return GetUserUsableGroups(userGroup)
	}

	descriptions := normalizeGroupKeys(setting.GetUserUsableGroupsCopy())
	groups := make(map[string]string)
	for group := range ratio_setting.GetGroupRatioCopy() {
		description := descriptions[group]
		if strings.TrimSpace(description) == "" {
			description = group
		}
		groups[group] = description
	}
	return groups
}

func normalizeGroupKeys(groups map[string]string) map[string]string {
	normalized := make(map[string]string, len(groups))
	for name, desc := range groups {
		if strings.EqualFold(name, "default") {
			name = "default"
		}
		normalized[name] = desc
	}
	return normalized
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	groupName = NormalizeGroupName(groupName)
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func GroupInUserUsableGroupsForRole(userGroup, groupName string, role int) bool {
	groupName = NormalizeGroupName(groupName)
	_, ok := GetUserUsableGroupsForRole(userGroup, role)[groupName]
	return ok
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	groups := GetUserUsableGroups(userGroup)
	autoGroups := make([]string, 0)
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; ok {
			autoGroups = append(autoGroups, group)
		}
	}
	return autoGroups
}

// GetUserGroupRatio 获取用户使用某个分组的倍率
// userGroup 用户分组
// group 需要获取倍率的分组
func GetUserGroupRatio(userGroup, group string) float64 {
	ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
	if ok {
		return ratio
	}
	return ratio_setting.GetGroupRatio(group)
}
