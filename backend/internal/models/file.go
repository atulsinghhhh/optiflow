package models

import (
	"time"

	"github.com/google/uuid"
)

type FileStatus string

const (
	FileStatusPending    FileStatus = "pending"
	FileStatusProcessing FileStatus = "processing"
	FileStatusReady      FileStatus = "ready"
	FileStatusFailed     FileStatus = "failed"
)

// File is upload/processing metadata for an object stored in MinIO. The bytes
// themselves are written by upload-svc via presigned URL — this table never holds
// file content, only the pointer (StorageKey) and bookkeeping around it.
type File struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name       string     `gorm:"not null" json:"name"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	FolderID   *uuid.UUID `gorm:"type:uuid;index" json:"folder_id"`
	StorageKey string     `gorm:"not null;uniqueIndex" json:"-"`
	SizeBytes  int64      `gorm:"not null" json:"size_bytes"`
	MimeType   string     `gorm:"not null" json:"mime_type"`
	Status     FileStatus `gorm:"not null;default:pending" json:"status"`
	Version    int        `gorm:"not null;default:1" json:"version"`
	ParentID   *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}
