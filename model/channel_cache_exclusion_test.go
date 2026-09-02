package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestGetRandomSatisfiedChannelWithExclusionsAllSamePriority(t *testing.T) {
	originalCache := common.MemoryCacheEnabled
	originalGroups := group2model2channels
	originalChannels := channelsIDM
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalCache
		group2model2channels = originalGroups
		channelsIDM = originalChannels
	})

	priority := int64(0)
	weight := uint(0)
	group2model2channels = map[string]map[string][]int{
		"default": {"test-model": {1, 2, 3}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
		3: {Id: 3, Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
	}
	common.MemoryCacheEnabled = true

	excluded := map[int]struct{}{1: {}}
	channel, err := GetRandomSatisfiedChannelWithExclusions("default", "test-model", 0, excluded)
	if err != nil {
		t.Fatalf("unexpected selection error: %v", err)
	}
	if channel == nil || channel.Id == 1 {
		t.Fatalf("selected excluded channel: %#v", channel)
	}

	excluded[channel.Id] = struct{}{}
	channel, err = GetRandomSatisfiedChannelWithExclusions("default", "test-model", 0, excluded)
	if err != nil {
		t.Fatalf("unexpected second selection error: %v", err)
	}
	if channel == nil {
		t.Fatal("expected one remaining channel")
	}
	if _, isExcluded := excluded[channel.Id]; isExcluded {
		t.Fatalf("selected excluded channel on second attempt: %d", channel.Id)
	}

	excluded[channel.Id] = struct{}{}
	channel, err = GetRandomSatisfiedChannelWithExclusions("default", "test-model", 0, excluded)
	if err != nil {
		t.Fatalf("unexpected exhausted selection error: %v", err)
	}
	if channel != nil {
		t.Fatalf("expected no channel after excluding all candidates, got %d", channel.Id)
	}
}

func TestGetRandomSatisfiedChannelMatchesModelCaseAndWhitespace(t *testing.T) {
	originalCache := common.MemoryCacheEnabled
	originalGroups := group2model2channels
	originalChannels := channelsIDM
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalCache
		group2model2channels = originalGroups
		channelsIDM = originalChannels
	})

	priority := int64(0)
	weight := uint(0)
	group2model2channels = map[string]map[string][]int{
		"国产大模型": {"minimax-m3": {231}},
	}
	channelsIDM = map[int]*Channel{
		231: {Id: 231, Status: common.ChannelStatusEnabled, Priority: &priority, Weight: &weight},
	}
	common.MemoryCacheEnabled = true

	channel, err := GetRandomSatisfiedChannelWithExclusions(" 国产大模型 ", "MiniMax-M3 ", 0, nil)
	if err != nil {
		t.Fatalf("unexpected selection error: %v", err)
	}
	if channel == nil || channel.Id != 231 {
		t.Fatalf("expected channel 231, got %#v", channel)
	}
}
