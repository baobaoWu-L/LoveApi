package model

import "testing"

func TestNormalizeNewUserGroup(t *testing.T) {
	tests := map[string]string{
		"":          "default",
		"   ":       "default",
		"Default":   "default",
		" default ": "default",
		"vip":       "vip",
	}
	for input, want := range tests {
		if got := normalizeNewUserGroup(input); got != want {
			t.Fatalf("normalizeNewUserGroup(%q) = %q, want %q", input, got, want)
		}
	}
}
