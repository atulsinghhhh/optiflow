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

const TypeVideoTranscode = "video:transcode"

type VideoTranscodePayload struct {
	FileID     uuid.UUID `json:"file_id"`
	StorageKey string    `json:"storage_key"`
}

// NewVideoTranscodeTask builds the video:transcode task, consumed by video-worker.
// Lower MaxRetry and a much longer Timeout than image:thumbnail — a transcode can
// legitimately take minutes, and retrying an expensive multi-rendition ffmpeg run
// 5 times over would waste worker capacity for very little benefit.
func NewVideoTranscodeTask(payload VideoTranscodePayload) (*asynq.Task, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling video transcode payload: %w", err)
	}
	return asynq.NewTask(TypeVideoTranscode, b, asynq.MaxRetry(2), asynq.Timeout(30*time.Minute)), nil
}
