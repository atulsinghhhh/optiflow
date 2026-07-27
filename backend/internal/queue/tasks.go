// Package queue defines asynq task payloads and task name constants.
// Every job type is defined exactly once here; each is consumed by exactly one worker.
package queue

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const TypeImageThumbnail = "image:thumbnail"

type ImageThumbnailPayload struct {
	FileID     uuid.UUID `json:"file_id"`
	StorageKey string    `json:"storage_key"`
}

// NewImageThumbnailTask builds the image:thumbnail task, consumed by image-worker.
// Retry/backoff live here so every producer gets the same policy: 5 attempts,
// asynq's default exponential backoff, archived (DLQ) after the final failure.
func NewImageThumbnailTask(payload ImageThumbnailPayload) (*asynq.Task, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling image thumbnail payload: %w", err)
	}
	return asynq.NewTask(TypeImageThumbnail, b, asynq.MaxRetry(5), asynq.Timeout(2*time.Minute)), nil
}
