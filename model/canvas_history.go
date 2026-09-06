package model

import "time"

// CanvasHistory stores one user's generated canvas result. Image bytes live on
// the server filesystem; Payload contains only generation metadata.
type CanvasHistory struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	UserID    int    `json:"user_id" gorm:"index;uniqueIndex:idx_canvas_history_user_image"`
	ImageID   string `json:"image_id" gorm:"type:varchar(191);uniqueIndex:idx_canvas_history_user_image"`
	Payload   string `json:"payload" gorm:"type:text"`
	FilePath  string `json:"-" gorm:"type:text"`
	MimeType  string `json:"mime_type" gorm:"type:varchar(64)"`
	CreatedAt time.Time `json:"created_at" gorm:"index"`
	UpdatedAt time.Time `json:"updated_at"`
}

func NewCanvasHistory(userID int, imageID, payload string) *CanvasHistory {
	now := time.Now()
	return &CanvasHistory{UserID: userID, ImageID: imageID, Payload: payload, CreatedAt: now, UpdatedAt: now}
}
