package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestFilterPricingByUsableGroupsRequiresModelInSelectedGroupSet(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "default-model", EnableGroup: []string{"default"}},
		{ModelName: "private-model", EnableGroup: []string{"private"}},
	}

	filtered := filterPricingByUsableGroups(pricing, map[string]string{"default": "default"})
	if len(filtered) != 1 || filtered[0].ModelName != "default-model" {
		t.Fatalf("default pricing leaked a model from another group: %#v", filtered)
	}
}
