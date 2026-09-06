package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestAdminCanUseEveryConfiguredGroup(t *testing.T) {
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		if err := setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups); err != nil {
			t.Fatalf("restore UserUsableGroups: %v", err)
		}
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio); err != nil {
			t.Fatalf("restore GroupRatio: %v", err)
		}
	})

	if err := setting.UpdateUserUsableGroupsByJSONString(`{}`); err != nil {
		t.Fatalf("clear UserUsableGroups: %v", err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"private":2}`); err != nil {
		t.Fatalf("set GroupRatio: %v", err)
	}

	ordinaryGroups := GetUserUsableGroupsForRole("default", common.RoleCommonUser)
	if _, ok := ordinaryGroups["private"]; ok {
		t.Fatal("ordinary user unexpectedly received private group")
	}

	adminGroups := GetUserUsableGroupsForRole("default", common.RoleAdminUser)
	for _, group := range []string{"default", "private"} {
		if _, ok := adminGroups[group]; !ok {
			t.Fatalf("administrator is missing configured group %q", group)
		}
	}
}

func TestNormalizeGroupNameLegacyMinimax(t *testing.T) {
	if got := NormalizeGroupName(" MINIMAX "); got != "国产大模型" {
		t.Fatalf("expected legacy MINIMAX to map to 国产大模型, got %q", got)
	}
}
