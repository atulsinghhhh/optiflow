package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/hibiken/asynq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/queue"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

var jobsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "video_worker_jobs_total",
	Help: "Video transcode jobs processed, by outcome.",
}, []string{"status"})

type handler struct {
	db      *gorm.DB
	storage *storage.Client
}

func (h *handler) handleVideoTranscode(ctx context.Context, t *asynq.Task) error {
	var payload queue.VideoTranscodePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return fmt.Errorf("%w: unmarshaling payload: %v", asynq.SkipRetry, err)
	}

	if err := h.transcode(ctx, payload); err != nil {
		jobsTotal.WithLabelValues("failure").Inc()
		return err
	}

	jobsTotal.WithLabelValues("success").Inc()
	return nil
}

func (h *handler) transcode(ctx context.Context, payload queue.VideoTranscodePayload) error {
	tmpDir, err := os.MkdirTemp("", "video-worker-*")
	if err != nil {
		return fmt.Errorf("creating temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	inputPath := filepath.Join(tmpDir, "input"+path.Ext(payload.StorageKey))
	if err := h.downloadOriginal(ctx, payload.StorageKey, inputPath); err != nil {
		return err
	}

	srcWidth, srcHeight, err := probeDimensions(ctx, inputPath)
	if err != nil {
		return fmt.Errorf("%w: %v", asynq.SkipRetry, err)
	}

	duration, err := probeDuration(ctx, inputPath)
	if err != nil {
		return fmt.Errorf("%w: %v", asynq.SkipRetry, err)
	}

	outDir := filepath.Join(tmpDir, "out")
	if err := os.Mkdir(outDir, 0o755); err != nil {
		return fmt.Errorf("creating output dir: %w", err)
	}

	posterPath := filepath.Join(outDir, "poster.jpg")
	posterTimestamp := math.Min(1.0, duration/2)
	if err := extractPoster(ctx, inputPath, posterPath, posterTimestamp); err != nil {
		return fmt.Errorf("extracting poster: %w", err)
	}

	renditions := selectRenditions(srcHeight)
	for _, r := range renditions {
		if err := transcodeRendition(ctx, inputPath, outDir, r); err != nil {
			return fmt.Errorf("transcoding %s: %w", r.Name, err)
		}
	}

	prefix := fmt.Sprintf("hls/%s", payload.FileID)

	posterKey := prefix + "/poster.jpg"
	if err := h.uploadFile(ctx, posterPath, posterKey, "image/jpeg"); err != nil {
		return fmt.Errorf("uploading poster: %w", err)
	}

	if err := h.uploadRenditionFiles(ctx, outDir, prefix); err != nil {
		return err
	}

	masterKey := prefix + "/master.m3u8"
	master := buildMasterPlaylist(renditions, srcWidth, srcHeight)
	if err := h.storage.PutObject(ctx, masterKey, strings.NewReader(master), int64(len(master)), "application/vnd.apple.mpegurl"); err != nil {
		return fmt.Errorf("uploading master playlist: %w", err)
	}

	if err := h.db.Model(&models.File{}).Where("id = ?", payload.FileID).Updates(map[string]any{
		"thumbnail_key": posterKey,
		"playlist_key":  masterKey,
		"status":        models.FileStatusReady,
	}).Error; err != nil {
		return fmt.Errorf("updating file record: %w", err)
	}

	log.Info().
		Str("file_id", payload.FileID.String()).
		Str("playlist_key", masterKey).
		Int("renditions", len(renditions)).
		Msg("transcoded video")
	return nil
}

func (h *handler) downloadOriginal(ctx context.Context, storageKey, destPath string) error {
	obj, err := h.storage.GetObject(ctx, storageKey)
	if err != nil {
		return fmt.Errorf("fetching original object: %w", err)
	}
	defer obj.Close()

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("creating local temp file: %w", err)
	}
	defer f.Close()

	if _, err := f.ReadFrom(obj); err != nil {
		return fmt.Errorf("downloading original object: %w", err)
	}
	return nil
}

func (h *handler) uploadFile(ctx context.Context, localPath, objectKey, contentType string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("opening %q: %w", localPath, err)
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("statting %q: %w", localPath, err)
	}

	return h.storage.PutObject(ctx, objectKey, f, info.Size(), contentType)
}

// uploadRenditionFiles uploads every HLS variant playlist (.m3u8) and segment
// (.ts) ffmpeg wrote into outDir — the poster and master playlist are handled
// separately since they aren't produced per-rendition.
func (h *handler) uploadRenditionFiles(ctx context.Context, outDir, prefix string) error {
	entries, err := os.ReadDir(outDir)
	if err != nil {
		return fmt.Errorf("reading output dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == "poster.jpg" {
			continue
		}

		contentType := "video/mp2t"
		if path.Ext(entry.Name()) == ".m3u8" {
			contentType = "application/vnd.apple.mpegurl"
		}

		localPath := filepath.Join(outDir, entry.Name())
		objectKey := prefix + "/" + entry.Name()
		if err := h.uploadFile(ctx, localPath, objectKey, contentType); err != nil {
			return fmt.Errorf("uploading %s: %w", entry.Name(), err)
		}
	}
	return nil
}

// handleTaskError marks a file permanently failed once its task has exhausted
// every retry (or immediately for asynq.SkipRetry, which aborts remaining
// attempts without the retry count reaching MaxRetry the same way ordinary
// failures do).
func (h *handler) handleTaskError(ctx context.Context, task *asynq.Task, err error) {
	log.Error().Err(err).Str("type", task.Type()).Msg("task failed")

	terminal := errors.Is(err, asynq.SkipRetry)
	if !terminal {
		retried, ok := asynq.GetRetryCount(ctx)
		maxRetry, maxOk := asynq.GetMaxRetry(ctx)
		terminal = ok && maxOk && retried >= maxRetry
	}
	if !terminal {
		return
	}

	if task.Type() != queue.TypeVideoTranscode {
		return
	}

	var payload queue.VideoTranscodePayload
	if jsonErr := json.Unmarshal(task.Payload(), &payload); jsonErr != nil {
		return
	}

	if updErr := h.db.Model(&models.File{}).Where("id = ?", payload.FileID).Update("status", models.FileStatusFailed).Error; updErr != nil {
		log.Error().Err(updErr).Str("file_id", payload.FileID.String()).Msg("marking file failed after exhausted retries")
	}
}
