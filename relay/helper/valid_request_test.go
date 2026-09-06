package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestNormalizeGPTImage2Size(t *testing.T) {
	tests := []struct {
		name        string
		size        string
		aspectRatio string
		wantSize    string
	}{
		{name: "pixel preset", size: "1672x941", wantSize: "16:9"},
		{name: "explicit aspect wins", size: "941x1672", aspectRatio: "16:9", wantSize: "16:9"},
		{name: "already normalized", size: "16:9", wantSize: "16:9"},
		{name: "other model untouched", size: "1672x941", wantSize: "1672x941"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model := "gpt-image-2"
			if tt.name == "other model untouched" {
				model = "dall-e-3"
			}
			request := &dto.ImageRequest{Model: model, Size: tt.size, AspectRatio: tt.aspectRatio}
			normalizeGPTImage2Size(request)
			if request.Size != tt.wantSize {
				t.Fatalf("size = %q, want %q", request.Size, tt.wantSize)
			}
			if model == "gpt-image-2" && request.AspectRatio != "" {
				t.Fatalf("aspect_ratio should be folded into size, got %q", request.AspectRatio)
			}
		})
	}
}
