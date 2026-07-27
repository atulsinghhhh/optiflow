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

type File struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name       string     `gorm:"not null" json:"name"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	FolderID   *uuid.UUID `gorm:"type:uuid;index" json:"folder_id"`
	StorageKey string     `gorm:"not null;uniqueIndex" json:"-"`
	SizeBytes  int64      `gorm:"not null" json:"size_bytes"`
	MimeType   string     `gorm:"not null" json:"mime_type"`
	Status     FileStatus `gorm:"not null;default:pending" json:"status"`
	// ThumbnailKey is a preview JPEG: for images, set by image-worker on success;
	// for videos, set by video-worker to a poster frame grabbed from the transcode.
	// Nil until processing succeeds, or for file types that don't get a preview.
	ThumbnailKey *string `json:"thumbnail_key,omitempty"`
	// PlaylistKey is the HLS master .m3u8 for video files, set by video-worker on
	// success. Nil for non-video files, or videos still processing/failed.
	PlaylistKey *string    `json:"playlist_key,omitempty"`
	Version     int        `gorm:"not null;default:1" json:"version"`
	ParentID    *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
