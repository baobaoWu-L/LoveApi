package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func IsChannelEnabledForGroupModel(group string, modelName string, channelID int) bool {
	if group == "" || modelName == "" || channelID <= 0 {
		return false
	}
	if !common.MemoryCacheEnabled {
		return isChannelEnabledForGroupModelDB(group, modelName, channelID)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	if group2model2channels == nil {
		return false
	}

	if isChannelIDInList(getCachedChannels(group, modelName), channelID) {
		return true
	}
	return false
}

func IsChannelEnabledForAnyGroupModel(groups []string, modelName string, channelID int) bool {
	if len(groups) == 0 {
		return false
	}
	for _, g := range groups {
		if IsChannelEnabledForGroupModel(g, modelName, channelID) {
			return true
		}
	}
	return false
}

func isChannelEnabledForGroupModelDB(group string, modelName string, channelID int) bool {
	group = strings.TrimSpace(group)
	modelName = strings.TrimSpace(modelName)
	var count int64
	err := DB.Model(&Ability{}).
		Where(commonGroupCol+" = ? and model = ? and channel_id = ? and enabled = ?", group, modelName, channelID, true).
		Count(&count).Error
	if err == nil && count > 0 {
		return true
	}
	// PostgreSQL/SQLite may use case-sensitive collations. Fall back to a
	// normalized in-memory comparison so case-only aliases and whitespace do
	// not make an enabled channel appear unavailable.
	var abilities []Ability
	if err := DB.Where("enabled = ?", true).Find(&abilities).Error; err != nil {
		return false
	}
	wanted := modelName
	normalized := strings.TrimSpace(ratio_setting.FormatMatchingModelName(wanted))
	for _, ability := range abilities {
		if ability.ChannelId != channelID || !strings.EqualFold(strings.TrimSpace(ability.Group), group) {
			continue
		}
		candidate := strings.TrimSpace(ability.Model)
		if strings.EqualFold(candidate, wanted) || (normalized != "" && strings.EqualFold(candidate, normalized)) {
			return true
		}
	}
	return false
}

func isChannelIDInList(list []int, channelID int) bool {
	for _, id := range list {
		if id == channelID {
			return true
		}
	}
	return false
}
