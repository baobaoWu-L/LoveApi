package ratio_setting

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
)

var defaultGroupRatio = map[string]float64{
	"default": 1,
	"vip":     1,
	"svip":    1,
}

var groupRatioMap = types.NewRWMap[string, float64]()

var defaultGroupGroupRatio = map[string]map[string]float64{
	"vip": {
		"edit_this": 0.9,
	},
}

var groupGroupRatioMap = types.NewRWMap[string, map[string]float64]()

var defaultGroupSpecialUsableGroup = map[string]map[string]string{
	"vip": {
		"append_1":   "vip_special_group_1",
		"-:remove_1": "vip_removed_group_1",
	},
}

type GroupRatioSetting struct {
	GroupRatio              *types.RWMap[string, float64]            `json:"group_ratio"`
	GroupGroupRatio         *types.RWMap[string, map[string]float64] `json:"group_group_ratio"`
	GroupSpecialUsableGroup *types.RWMap[string, map[string]string]  `json:"group_special_usable_group"`
}

var groupRatioSetting GroupRatioSetting

func init() {
	groupSpecialUsableGroup := types.NewRWMap[string, map[string]string]()
	groupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)

	groupRatioMap.AddAll(defaultGroupRatio)
	groupGroupRatioMap.AddAll(defaultGroupGroupRatio)

	groupRatioSetting = GroupRatioSetting{
		GroupSpecialUsableGroup: groupSpecialUsableGroup,
		GroupRatio:              groupRatioMap,
		GroupGroupRatio:         groupGroupRatioMap,
	}

	config.GlobalConfig.Register("group_ratio_setting", &groupRatioSetting)
}

func GetGroupRatioSetting() *GroupRatioSetting {
	if groupRatioSetting.GroupSpecialUsableGroup == nil {
		groupRatioSetting.GroupSpecialUsableGroup = types.NewRWMap[string, map[string]string]()
		groupRatioSetting.GroupSpecialUsableGroup.AddAll(defaultGroupSpecialUsableGroup)
	}
	return &groupRatioSetting
}

func GetGroupRatioCopy() map[string]float64 {
	groups := groupRatioMap.ReadAll()
	// `default` is the canonical public name. Keep compatibility with
	// installations that stored the key as `Default`.
	for name, ratio := range groups {
		if strings.EqualFold(name, "default") && name != "default" {
			if _, exists := groups["default"]; !exists {
				groups["default"] = ratio
			}
			delete(groups, name)
		}
	}
	return groups
}

func ContainsGroupRatio(name string) bool {
	if strings.EqualFold(name, "default") {
		name = "default"
	}
	if _, ok := groupRatioMap.Get(name); ok {
		return true
	}
	for configured := range groupRatioMap.ReadAll() {
		if strings.EqualFold(configured, name) {
			return true
		}
	}
	return false
}

func GroupRatio2JSONString() string {
	return groupRatioMap.MarshalJSONString()
}

func UpdateGroupRatioByJSONString(jsonStr string) error {
	// 保护：拒绝字符集损坏（中文被替换为 ?/�）的 GroupRatio，避免分组名在运行时无法匹配。
	if strings.Contains(jsonStr, "?") || strings.ContainsRune(jsonStr, '�') {
		return errors.New("GroupRatio 含非法占位字符（疑似字符集损坏），拒绝写入")
	}
	var values map[string]float64
	if err := common.Unmarshal([]byte(jsonStr), &values); err != nil {
		return err
	}
	normalized := make(map[string]float64, len(values))
	for name, ratio := range values {
		if strings.EqualFold(name, "default") {
			name = "default"
		}
		normalized[name] = ratio
	}
	data, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	return types.LoadFromJsonString(groupRatioMap, string(data))
}

func GetGroupRatio(name string) float64 {
	if strings.EqualFold(name, "default") {
		name = "default"
	}
	ratio, ok := groupRatioMap.Get(name)
	if !ok {
		for configured, value := range groupRatioMap.ReadAll() {
			if strings.EqualFold(configured, name) {
				return value
			}
		}
	}
	if !ok {
		common.SysLog("group ratio not found: " + name)
		return 1
	}
	return ratio
}

func GetGroupGroupRatio(userGroup, usingGroup string) (float64, bool) {
	gp, ok := groupGroupRatioMap.Get(userGroup)
	if !ok {
		return -1, false
	}
	ratio, ok := gp[usingGroup]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func GroupGroupRatio2JSONString() string {
	return groupGroupRatioMap.MarshalJSONString()
}

func UpdateGroupGroupRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(groupGroupRatioMap, jsonStr)
}

func CheckGroupRatio(jsonStr string) error {
	checkGroupRatio := make(map[string]float64)
	err := common.Unmarshal([]byte(jsonStr), &checkGroupRatio)
	if err != nil {
		return err
	}
	for name, ratio := range checkGroupRatio {
		if ratio < 0 {
			return errors.New("group ratio must be not less than 0: " + name)
		}
	}
	return nil
}
