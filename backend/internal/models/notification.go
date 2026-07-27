package models

import (
	"time"

	"github.com/google/uuid"
)

type NotificationType string

const (
	NotificationTypeSystem  NotificationType = "system"
	NotificationTypeStorage NotificationType = "storage"
	NotificationTypeShare   NotificationType = "share"
)

type Notification struct {
	ID        uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID        `gorm:"type:uuid;not null;index" json:"user_id"`
	Type      NotificationType `gorm:"not null;default:system" json:"type"`
	Title     string           `gorm:"not null" json:"title"`
	Message   string           `gorm:"not null" json:"message"`
	ActionURL *string          `json:"action_url,omitempty"`
	Read      bool             `gorm:"not null;default:false" json:"read"`
	CreatedAt time.Time        `json:"created_at"`
}
