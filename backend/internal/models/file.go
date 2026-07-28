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
	PlaylistKey *string `json:"playlist_key,omitempty"`
	Version     int     `gorm:"not null;default:1" json:"version"`
	// ParentID points at the lineage root (the very first File row for this
	// logical file) — nil on that root row itself. Every version of the same
	// logical file shares one root, which is what GET /files/{id}/versions
	// walks to find the full history.
	ParentID *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	// IsCurrent marks which version is "the file" for listings and default
	// downloads — exactly one true row per lineage at a time. Uploading a new
	// version or restoring an old one flips this flag; it never creates or
	// deletes rows outside of those two operations.
	IsCurrent bool      `gorm:"not null;default:true;index" json:"is_current"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
