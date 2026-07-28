package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/queue"
	"github.com/atulsinghhhh/optiflow/internal/storage"
)

const presignExpiry = 15 * time.Minute

var errQuotaExceeded = errors.New("storage quota exceeded")

type handler struct {
	db      *gorm.DB
	storage *storage.Client
	queue   *asynq.Client
}

// checkQuota rejects an upload before it's ever presigned if it would push
// the user over their quota. This trusts the client's declared size_bytes —
// good enough to stop honest-mistake overages at v1, but not adversarial-proof
// (a client could lie and upload more than declared); closing that gap would
// mean checking again in complete() and cleaning up the MinIO object on
// rejection, which is a bigger change left for when quota enforcement needs
// to be airtight (e.g. once quotas are tied to billing in v3).
func (h *handler) checkQuota(userID uuid.UUID, incomingBytes int64) error {
	var user models.User
	if err := h.db.Select("storage_quota_bytes").Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("looking up user quota: %w", err)
	}

	var used int64
	if err := h.db.Model(&models.File{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(size_bytes), 0)").Scan(&used).Error; err != nil {
		return fmt.Errorf("summing current storage usage: %w", err)
	}

	if used+incomingBytes > user.StorageQuotaBytes {
		return fmt.Errorf("%w: %d of %d bytes used, this upload needs %d more",
			errQuotaExceeded, used, user.StorageQuotaBytes, incomingBytes)
	}
	return nil
}

type presignRequest struct {
	Name      string  `json:"name"`
	SizeBytes int64   `json:"size_bytes"`
	MimeType  string  `json:"mime_type"`
	FolderID  *string `json:"folder_id"`
}

type presignResponse struct {
	FileID    uuid.UUID `json:"file_id"`
	UploadURL string    `json:"upload_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (h *handler) presign(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var req presignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.SizeBytes <= 0 || req.MimeType == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name, size_bytes, and mime_type are required")
		return
	}

	if err := h.checkQuota(userID, req.SizeBytes); err != nil {
		if errors.Is(err, errQuotaExceeded) {
			httpx.WriteError(w, http.StatusRequestEntityTooLarge, err.Error())
			return
		}
		log.Error().Err(err).Msg("checking storage quota")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	var folderID *uuid.UUID
	if req.FolderID != nil && *req.FolderID != "" {
		id, err := uuid.Parse(*req.FolderID)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid folder_id")
			return
		}
		var folder models.Folder
		if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&folder).Error; err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "folder not found")
			return
		}
		folderID = &id
	}

	fileID := uuid.New()
	storageKey := fmt.Sprintf("users/%s/%s/%s", userID, fileID, req.Name)

	file := models.File{
		ID:         fileID,
		Name:       req.Name,
		UserID:     userID,
		FolderID:   folderID,
		StorageKey: storageKey,
		SizeBytes:  req.SizeBytes,
		MimeType:   req.MimeType,
		Status:     models.FileStatusPending,
		Version:    1,
	}
	if err := h.db.Create(&file).Error; err != nil {
		log.Error().Err(err).Msg("creating file record")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	uploadURL, err := h.storage.PresignedPutURL(r.Context(), storageKey, presignExpiry)
	if err != nil {
		log.Error().Err(err).Msg("presigning upload url")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, presignResponse{
		FileID:    fileID,
		UploadURL: uploadURL.String(),
		ExpiresAt: time.Now().Add(presignExpiry),
	})
}

func (h *handler) complete(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&file).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "file not found")
			return
		}
		log.Error().Err(err).Msg("looking up file")
		httpx.WriteError(w, http.StatusInternalServerError, "could not complete upload")
		return
	}

	if file.Status != models.FileStatusPending {
		httpx.WriteError(w, http.StatusConflict, "upload already completed")
		return
	}

	info, err := h.storage.StatObject(r.Context(), file.StorageKey)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "upload not found in storage — retry the upload")
		return
	}

	// Trust MinIO's observed size over whatever the client declared at presign time.
	file.SizeBytes = info.Size

	isImage := strings.HasPrefix(file.MimeType, "image/")
	isVideo := strings.HasPrefix(file.MimeType, "video/")
	if isImage || isVideo {
		file.Status = models.FileStatusProcessing
	} else {
		file.Status = models.FileStatusReady
	}

	if err := h.db.Save(&file).Error; err != nil {
		log.Error().Err(err).Msg("marking file uploaded")
		httpx.WriteError(w, http.StatusInternalServerError, "could not complete upload")
		return
	}

	switch {
	case isImage:
		task, err := queue.NewImageThumbnailTask(queue.ImageThumbnailPayload{
			FileID:     file.ID,
			StorageKey: file.StorageKey,
		})
		h.enqueueOrLog(task, err, "image thumbnail", file.ID)
	case isVideo:
		task, err := queue.NewVideoTranscodeTask(queue.VideoTranscodePayload{
			FileID:     file.ID,
			StorageKey: file.StorageKey,
		})
		h.enqueueOrLog(task, err, "video transcode", file.ID)
	}

	httpx.WriteJSON(w, http.StatusOK, file)
}

type downloadURLResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

const downloadExpiry = 15 * time.Minute

// downloadURL turns a stored file's object key into a time-limited, directly
// fetchable URL. Lives here (not api-svc) because upload-svc already owns the
// storage client — api-svc never touches MinIO directly.
func (h *handler) downloadURL(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	var file models.File
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&file).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "file not found")
			return
		}
		log.Error().Err(err).Msg("looking up file")
		httpx.WriteError(w, http.StatusInternalServerError, "could not build download url")
		return
	}

	key := file.StorageKey
	if r.URL.Query().Get("variant") == "thumbnail" {
		if file.ThumbnailKey == nil {
			httpx.WriteError(w, http.StatusNotFound, "no thumbnail available for this file")
			return
		}
		key = *file.ThumbnailKey
	} else if file.Status == models.FileStatusPending {
		httpx.WriteError(w, http.StatusConflict, "file has not finished uploading yet")
		return
	}

	u, err := h.storage.PresignedGetURL(r.Context(), key, downloadExpiry)
	if err != nil {
		log.Error().Err(err).Msg("presigning download url")
		httpx.WriteError(w, http.StatusInternalServerError, "could not build download url")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, downloadURLResponse{
		URL:       u.String(),
		ExpiresAt: time.Now().Add(downloadExpiry),
	})
}

// enqueueOrLog enqueues a processing task, logging failures loudly rather than
// failing the request — the upload itself already succeeded, but a queueing
// hiccup here means the file will be stuck at status=processing indefinitely.
func (h *handler) enqueueOrLog(task *asynq.Task, buildErr error, jobName string, fileID uuid.UUID) {
	if buildErr != nil {
		log.Error().Err(buildErr).Str("job", jobName).Msg("building task")
		return
	}
	if _, err := h.queue.Enqueue(task); err != nil {
		log.Error().Err(err).Str("job", jobName).Str("file_id", fileID.String()).Msg("enqueueing task")
	}
}
