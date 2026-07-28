package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Name         string    `gorm:"not null" json:"name"`
	// StorageQuotaBytes defaults to 5 GiB (5368709120) for every new user —
	// generous for typical v1 usage without being unbounded. Not yet
	// configurable per-user (e.g. for a billing tier); that's a v3 concern
	// once subscription tiers exist.
	StorageQuotaBytes int64     `gorm:"not null;default:5368709120" json:"storage_quota_bytes"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
