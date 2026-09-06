package model

import (
	"strconv"
	"time"

	"gorm.io/gorm"
)

type Midjourney struct {
	Id          int    `json:"id"`
	Code        int    `json:"code"`
	UserId      int    `json:"user_id" gorm:"index"`
	Action      string `json:"action" gorm:"type:varchar(40);index"`
	MjId        string `json:"mj_id" gorm:"index"`
	Prompt      string `json:"prompt"`
	PromptEn    string `json:"prompt_en"`
	Description string `json:"description"`
	State       string    `json:"state"`
	SubmitTime  time.Time `json:"submit_time" gorm:"type:datetime;index"`
	StartTime   time.Time `json:"start_time" gorm:"type:datetime;index"`
	FinishTime  time.Time `json:"finish_time" gorm:"type:datetime;index"`
	ImageUrl    string `json:"image_url"`
	VideoUrl    string `json:"video_url"`
	VideoUrls   string `json:"video_urls"`
	Status      string `json:"status" gorm:"type:varchar(20);index"`
	Progress    string `json:"progress" gorm:"type:varchar(30);index"`
	FailReason  string `json:"fail_reason"`
	ChannelId   int    `json:"channel_id"`
	Quota       int    `json:"quota"`
	Buttons     string `json:"buttons"`
	Properties  string `json:"properties"`
}

// BeforeCreate 在任务入库前填充时间字段，避免 time.Time 零值写入 MySQL
// 触发 '0000-00-00' DATETIME 报错(NO_ZERO_DATE)。
func (m *Midjourney) BeforeCreate(tx *gorm.DB) error {
	now := time.Now()
	if m.SubmitTime.IsZero() {
		m.SubmitTime = now
	}
	if m.StartTime.IsZero() {
		m.StartTime = now
	}
	if m.FinishTime.IsZero() {
		m.FinishTime = now
	}
	return nil
}

// MsToTime 将 unix 毫秒时间戳转换为 time.Time，0 或负值返回零值。
func MsToTime(ms int64) time.Time {
	if ms <= 0 {
		return time.Time{}
	}
	return time.UnixMilli(ms)
}

// SubmitTimeMs 返回 submit_time 的 unix 毫秒，零值返回 0（供外部 DTO 使用）。
func (m *Midjourney) SubmitTimeMs() int64 {
	if m.SubmitTime.IsZero() {
		return 0
	}
	return m.SubmitTime.UnixMilli()
}

// StartTimeMs 返回 start_time 的 unix 毫秒，零值返回 0。
func (m *Midjourney) StartTimeMs() int64 {
	if m.StartTime.IsZero() {
		return 0
	}
	return m.StartTime.UnixMilli()
}

// FinishTimeMs 返回 finish_time 的 unix 毫秒，零值返回 0。
func (m *Midjourney) FinishTimeMs() int64 {
	if m.FinishTime.IsZero() {
		return 0
	}
	return m.FinishTime.UnixMilli()
}

// BeforeSave prevents user-provided prompts and descriptive payloads from
// being persisted in usage/task records. Task IDs, status, timing and billing
// fields remain available for polling and accounting.
func (m *Midjourney) BeforeSave(_ *gorm.DB) error {
	m.Prompt = ""
	m.PromptEn = ""
	m.Description = ""
	m.Buttons = ""
	m.Properties = ""
	return nil
}

// TaskQueryParams 用于包含所有搜索条件的结构体，可以根据需求添加更多字段
type TaskQueryParams struct {
	ChannelID      string
	MjID           string
	StartTimestamp string
	EndTimestamp   string
}

// queryMsToTime 将查询参数中的 unix 毫秒字符串转换为 time.Time，无法解析或为空返回 nil。
func queryMsToTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	ms, err := strconv.ParseInt(s, 10, 64)
	if err != nil || ms <= 0 {
		return nil
	}
	t := time.UnixMilli(ms)
	return &t
}

func GetAllUserTask(userId int, startIdx int, num int, queryParams TaskQueryParams) []*Midjourney {
	var tasks []*Midjourney
	var err error

	// 初始化查询构建器
	query := DB.Where("user_id = ?", userId)

	if queryParams.MjID != "" {
		query = query.Where("mj_id = ?", queryParams.MjID)
	}
	if start := queryMsToTime(queryParams.StartTimestamp); start != nil {
		query = query.Where("submit_time >= ?", *start)
	}
	if end := queryMsToTime(queryParams.EndTimestamp); end != nil {
		query = query.Where("submit_time <= ?", *end)
	}

	// 获取数据
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func GetAllTasks(startIdx int, num int, queryParams TaskQueryParams) []*Midjourney {
	var tasks []*Midjourney
	var err error

	// 初始化查询构建器
	query := DB

	// 添加过滤条件
	if queryParams.ChannelID != "" {
		query = query.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.MjID != "" {
		query = query.Where("mj_id = ?", queryParams.MjID)
	}
	if start := queryMsToTime(queryParams.StartTimestamp); start != nil {
		query = query.Where("submit_time >= ?", *start)
	}
	if end := queryMsToTime(queryParams.EndTimestamp); end != nil {
		query = query.Where("submit_time <= ?", *end)
	}

	// 获取数据
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func GetAllUnFinishTasks() []*Midjourney {
	var tasks []*Midjourney
	var err error
	// get all tasks progress is not 100%
	err = DB.Where("progress != ?", "100%").Find(&tasks).Error
	if err != nil {
		return nil
	}
	return tasks
}

func GetByOnlyMJId(mjId string) *Midjourney {
	var mj *Midjourney
	var err error
	err = DB.Where("mj_id = ?", mjId).First(&mj).Error
	if err != nil {
		return nil
	}
	return mj
}

func GetByMJId(userId int, mjId string) *Midjourney {
	var mj *Midjourney
	var err error
	err = DB.Where("user_id = ? and mj_id = ?", userId, mjId).First(&mj).Error
	if err != nil {
		return nil
	}
	return mj
}

func GetByMJIds(userId int, mjIds []string) []*Midjourney {
	var mj []*Midjourney
	var err error
	err = DB.Where("user_id = ? and mj_id in (?)", userId, mjIds).Find(&mj).Error
	if err != nil {
		return nil
	}
	return mj
}

func GetMjByuId(id int) *Midjourney {
	var mj *Midjourney
	var err error
	err = DB.Where("id = ?", id).First(&mj).Error
	if err != nil {
		return nil
	}
	return mj
}

func UpdateProgress(id int, progress string) error {
	return DB.Model(&Midjourney{}).Where("id = ?", id).Update("progress", progress).Error
}

func (midjourney *Midjourney) Insert() error {
	var err error
	err = DB.Create(midjourney).Error
	return err
}

func (midjourney *Midjourney) Update() error {
	var err error
	err = DB.Save(midjourney).Error
	return err
}

// UpdateWithStatus performs a conditional UPDATE guarded by fromStatus (CAS).
// Returns (true, nil) if this caller won the update, (false, nil) if
// another process already moved the task out of fromStatus.
// UpdateWithStatus performs a conditional UPDATE guarded by fromStatus (CAS).
// Uses Model().Select("*").Updates() to avoid GORM Save()'s INSERT fallback.
func (midjourney *Midjourney) UpdateWithStatus(fromStatus string) (bool, error) {
	result := DB.Model(midjourney).Where("status = ?", fromStatus).Select("*").Updates(midjourney)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func MjBulkUpdate(mjIds []string, params map[string]any) error {
	return DB.Model(&Midjourney{}).
		Where("mj_id in (?)", mjIds).
		Updates(params).Error
}

func MjBulkUpdateByTaskIds(taskIDs []int, params map[string]any) error {
	return DB.Model(&Midjourney{}).
		Where("id in (?)", taskIDs).
		Updates(params).Error
}

// CountAllTasks returns total midjourney tasks for admin query
func CountAllTasks(queryParams TaskQueryParams) int64 {
	var total int64
	query := DB.Model(&Midjourney{})
	if queryParams.ChannelID != "" {
		query = query.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.MjID != "" {
		query = query.Where("mj_id = ?", queryParams.MjID)
	}
	if start := queryMsToTime(queryParams.StartTimestamp); start != nil {
		query = query.Where("submit_time >= ?", *start)
	}
	if end := queryMsToTime(queryParams.EndTimestamp); end != nil {
		query = query.Where("submit_time <= ?", *end)
	}
	_ = query.Count(&total).Error
	return total
}

// CountAllUserTask returns total midjourney tasks for user
func CountAllUserTask(userId int, queryParams TaskQueryParams) int64 {
	var total int64
	query := DB.Model(&Midjourney{}).Where("user_id = ?", userId)
	if queryParams.MjID != "" {
		query = query.Where("mj_id = ?", queryParams.MjID)
	}
	if start := queryMsToTime(queryParams.StartTimestamp); start != nil {
		query = query.Where("submit_time >= ?", *start)
	}
	if end := queryMsToTime(queryParams.EndTimestamp); end != nil {
		query = query.Where("submit_time <= ?", *end)
	}
	_ = query.Count(&total).Error
	return total
}
