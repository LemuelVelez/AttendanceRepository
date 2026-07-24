package model

import "time"

const AdminRole = "admin"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Role         string    `gorm:"size:32;not null;default:admin" json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Upload struct {
	ID           string        `gorm:"primaryKey;size:36" json:"id"`
	OriginalName string        `gorm:"size:255;not null" json:"originalName"`
	College      string        `gorm:"size:255;index;not null" json:"college"`
	UploadedAt   time.Time     `gorm:"index;not null" json:"uploadedAt"`
	UpdatedAt    time.Time     `json:"updatedAt"`
	SizeBytes    int64         `gorm:"not null" json:"sizeBytes"`
	SheetCount   int           `gorm:"not null" json:"sheetCount"`
	RowCount     int           `gorm:"not null" json:"rowCount"`
	Sheets       []UploadSheet `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Rows         []UploadRow   `gorm:"constraint:OnDelete:CASCADE" json:"-"`
}

type UploadSheet struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UploadID    string    `gorm:"size:36;index;not null" json:"uploadId"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	Position    int       `gorm:"not null" json:"position"`
	HeadersJSON string    `gorm:"type:text;not null" json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
}

type UploadRow struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UploadID  string    `gorm:"size:36;index;not null" json:"uploadId"`
	SheetName string    `gorm:"size:255;index;not null" json:"sheetName"`
	RowNumber int       `gorm:"not null" json:"rowNumber"`
	DataJSON  string    `gorm:"type:text;not null" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

type WorkbookSheet struct {
	Name    string              `json:"name"`
	Headers []string            `json:"headers"`
	Rows    []map[string]string `json:"rows"`
}

type ParsedWorkbook struct {
	Sheets   []WorkbookSheet `json:"sheets"`
	RowCount int             `json:"rowCount"`
}

type PreviewManifest struct {
	ID           string         `json:"id"`
	OriginalName string         `json:"originalName"`
	College      string         `json:"college"`
	SizeBytes    int64          `json:"sizeBytes"`
	CreatedAt    time.Time      `json:"createdAt"`
	Workbook     ParsedWorkbook `json:"workbook"`
}
