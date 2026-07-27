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

type handler struct {
	db      *gorm.DB
	storage *storage.Client
	queue   *asynq.Client
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
	if isImage {
		file.Status = models.FileStatusProcessing
	} else {
		file.Status = models.FileStatusReady
	}

	if err := h.db.Save(&file).Error; err != nil {
		log.Error().Err(err).Msg("marking file uploaded")
		httpx.WriteError(w, http.StatusInternalServerError, "could not complete upload")
		return
	}

	if isImage {
		task, err := queue.NewImageThumbnailTask(queue.ImageThumbnailPayload{
			FileID:     file.ID,
			StorageKey: file.StorageKey,
		})
		if err != nil {
			log.Error().Err(err).Msg("building image thumbnail task")
		} else if _, err := h.queue.Enqueue(task); err != nil {
			// The upload itself succeeded — don't fail the request over a queueing
			// hiccup, but surface it loudly since the file will be stuck "processing".
			log.Error().Err(err).Str("file_id", file.ID.String()).Msg("enqueueing image thumbnail task")
		}
	}

	httpx.WriteJSON(w, http.StatusOK, file)
}
