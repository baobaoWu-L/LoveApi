package controller

import (
	"encoding/json"
	"testing"
)

func TestEndpointsConflictIgnoresUnspecifiedUpstream(t *testing.T) {
	if endpointsConflict(`{"openai":"/v1/chat/completions"}`, json.RawMessage("null")) {
		t.Fatal("null upstream endpoints must not conflict with a local endpoint")
	}
}

func TestEndpointsConflictCanonicalizesJSON(t *testing.T) {
	local := `{"openai":"/v1/chat/completions","anthropic":"/v1/messages"}`
	upstream := json.RawMessage(`{"anthropic":"/v1/messages","openai":"/v1/chat/completions"}`)
	if endpointsConflict(local, upstream) {
		t.Fatal("equivalent endpoint JSON with different key order must not conflict")
	}
}

func TestEndpointsConflictDetectsDifferentValues(t *testing.T) {
	local := `{"openai":"/v1/chat/completions"}`
	upstream := json.RawMessage(`{"openai":"/v1/responses"}`)
	if !endpointsConflict(local, upstream) {
		t.Fatal("different endpoint values must be reported as a conflict")
	}
}
