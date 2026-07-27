package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/disintegration/imaging"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/notify"
	"github.com/atulsinghhhh/optiflow/internal/queue"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

const (
	thumbnailMaxWidth  = 800
	thumbnailMaxHeight = 600
)

var jobsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "image_worker_jobs_total",
	Help: "Image thumbnail jobs processed, by outcome.",
}, []string{"status"})

type handler struct {
	db      *gorm.DB
	storage *storage.Client
	notify  *notify.Client // nil if notify-svc isn't configured — notifications are best-effort
}

// notifyUser looks up the file's owner and pushes a notification. A no-op if
// notify-svc isn't configured; failures here are logged, never propagated —
// a notification isn't worth failing an already-completed job over.
func (h *handler) notifyUser(ctx context.Context, fileID uuid.UUID, notifType models.NotificationType, title, messageFmt string) {
	if h.notify == nil {
		return
	}
	var file models.File
	if err := h.db.Select("user_id", "name").First(&file, "id = ?", fileID).Error; err != nil {
		log.Error().Err(err).Str("file_id", fileID.String()).Msg("looking up file for notification")
		return
	}
	if err := h.notify.Push(ctx, notify.PushRequest{
		UserID:  file.UserID,
		Type:    string(notifType),
		Title:   title,
		Message: fmt.Sprintf(messageFmt, file.Name),
	}); err != nil {
		log.Error().Err(err).Str("file_id", fileID.String()).Msg("pushing notification")
	}
}

func (h *handler) handleImageThumbnail(ctx context.Context, t *asynq.Task) error {
	var payload queue.ImageThumbnailPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("%w: unmarshaling payload: %v", asynq.SkipRetry, err)
	}

	obj, err := h.storage.GetObject(ctx, payload.StorageKey)
	if err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("fetching original object: %w", err)
	}
	defer obj.Close()

	img, err := imaging.Decode(obj)
	if err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("%w: decoding image: %v", asynq.SkipRetry, err)
	}

	thumbnail := imaging.Fit(img, thumbnailMaxWidth, thumbnailMaxHeight, imaging.Lanczos)

	var buf bytes.Buffer
	if err := imaging.Encode(&buf, thumbnail, imaging.JPEG); err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("encoding thumbnail: %w", err)
	}

	thumbnailKey := fmt.Sprintf("thumbnails/%s.jpg", payload.FileID)
	if err := h.storage.PutObject(ctx, thumbnailKey, &buf, int64(buf.Len()), "image/jpeg"); err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("uploading thumbnail: %w", err)
	}

	if err := h.db.Model(&models.File{}).Where("id = ?", payload.FileID).Updates(map[string]any{
		"thumbnail_key": thumbnailKey,
		"status":        models.FileStatusReady,
	}).Error; err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("updating file record: %w", err)
	}

	jobsTotal.WithLabelValues("success").Inc()
	log.Info().Str("file_id", payload.FileID.String()).Str("thumbnail_key", thumbnailKey).Msg("generated thumbnail")
	h.notifyUser(ctx, payload.FileID, models.NotificationTypeStorage, "Thumbnail ready", "Your thumbnail for %q is ready.")
	return nil
}

// handleTaskError marks a file permanently failed once its task has exhausted every
// retry — not on each individual attempt, since asynq will keep retrying regardless
// and an earlier attempt's failure doesn't mean the job is actually done for.
func (h *handler) handleTaskError(ctx context.Context, task *asynq.Task, err error) {
	log.Error().Err(err).Str("type", task.Type()).Msg("task failed")

	// asynq.SkipRetry aborts remaining attempts immediately regardless of retry
	// count, so it's terminal on its own — check it before the retry-count logic,
	// which only applies to ordinary (non-skipped) failures.
	terminal := errors.Is(err, asynq.SkipRetry)
	if !terminal {
		retried, ok := asynq.GetRetryCount(ctx)
		maxRetry, maxOk := asynq.GetMaxRetry(ctx)
		terminal = ok && maxOk && retried >= maxRetry
	}
	if !terminal {
		return
	}

	if task.Type() != queue.TypeImageThumbnail {
		return
	}

	var payload queue.ImageThumbnailPayload
	if jsonErr := json.Unmarshal(task.Payload(), &payload); jsonErr != nil {
		return
	}

	if updErr := h.db.Model(&models.File{}).Where("id = ?", payload.FileID).Update("status", models.FileStatusFailed).Error; updErr != nil {
		log.Error().Err(updErr).Str("file_id", payload.FileID.String()).Msg("marking file failed after exhausted retries")
	}

	h.notifyUser(ctx, payload.FileID, models.NotificationTypeStorage, "Processing failed", "We couldn't generate a thumbnail for %q.")
}
