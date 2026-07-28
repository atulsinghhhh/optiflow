package models

import (
	"time"

	"github.com/google/uuid"
)

// Share is a public, token-based link granting read/download access to a
// single File without requiring the recipient to authenticate. Optional
// expiry, password, and download-count limits are enforced by whoever
// resolves the token (api-svc for metadata, upload-svc for the actual
// presigned download).
type Share struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FileID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"file_id"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Token         string     `gorm:"not null;uniqueIndex" json:"token"`
	PasswordHash  *string    `json:"-"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	MaxDownloads  *int       `json:"max_downloads,omitempty"`
	DownloadCount int        `gorm:"not null;default:0" json:"download_count"`
	CreatedAt     time.Time  `json:"created_at"`
}
