package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSanitizeUsageOtherRemovesNestedContent(t *testing.T) {
	input := map[string]interface{}{
		"request_id": "req-1",
		"debug": map[string]interface{}{
			"Prompt":     "do not store",
			"latency_ms": 42,
		},
		"items": []interface{}{
			map[string]interface{}{"content": "secret", "provider": "safe"},
			map[string]interface{}{"model": "gpt-4o"},
		},
	}

	safe := sanitizeUsageOther(input)
	require.Equal(t, "req-1", safe["request_id"])
	require.NotContains(t, safe["debug"], "Prompt")
	require.Equal(t, 42, safe["debug"].(map[string]interface{})["latency_ms"])
	require.Len(t, safe["items"], 2)
	require.NotContains(t, safe["items"].([]interface{})[0], "content")
}
