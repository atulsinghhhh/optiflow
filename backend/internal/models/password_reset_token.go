package models

import (
	"time"

	"github.com/google/uuid"
)

// PasswordResetToken is a short-lived, single-use token for the password
// reset flow. TokenHash is a SHA-256 digest of the raw token handed to the
// user — hashed (not bcrypt) because the confirm step needs an exact lookup
// by token, not a compare against a known plaintext.
type PasswordResetToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash string    `gorm:"not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	Used      bool      `gorm:"not null;default:false" json:"-"`
	CreatedAt time.Time `json:"created_at"`
}
