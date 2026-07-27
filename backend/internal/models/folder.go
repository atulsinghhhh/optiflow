package models

import (
	"time"

	"github.com/google/uuid"
)

type Folder struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string     `gorm:"not null" json:"name"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	ParentID  *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
