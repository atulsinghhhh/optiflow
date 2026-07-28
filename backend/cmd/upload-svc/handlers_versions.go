package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

func lineageRootID(file models.File) uuid.UUID {
	if file.ParentID != nil {
		return *file.ParentID
	}
	return file.ID
}

type presignVersionRequest struct {
	SizeBytes int64  `json:"size_bytes"`
	MimeType  string `json:"mime_type"`
}

// presignVersion starts uploading a new version of an existing file. The new
// version's name/folder are inherited from the current version — only the
// bytes change — and it immediately becomes the current row (flipping
// is_current on the old one) so the rest of the app treats it as "the file"
// even while it's still processing, exactly like a brand-new upload does.
func (h *handler) presignVersion(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	var req presignVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.SizeBytes <= 0 || req.MimeType == "" {
		httpx.WriteError(w, http.StatusBadRequest, "size_bytes and mime_type are required")
		return
	}

	var anyVersion models.File
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&anyVersion).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "file not found")
			return
		}
		log.Error().Err(err).Msg("looking up file for new version")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}
	root := lineageRootID(anyVersion)

	if err := h.checkQuota(userID, req.SizeBytes); err != nil {
		if errors.Is(err, errQuotaExceeded) {
			httpx.WriteError(w, http.StatusRequestEntityTooLarge, err.Error())
			return
		}
		log.Error().Err(err).Msg("checking storage quota")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	var current models.File
	if err := h.db.Where("user_id = ? AND (id = ? OR parent_id = ?) AND is_current = ?", userID, root, root, true).
		First(&current).Error; err != nil {
		log.Error().Err(err).Msg("looking up current version")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	var maxVersion int
	if err := h.db.Model(&models.File{}).Where("user_id = ? AND (id = ? OR parent_id = ?)", userID, root, root).
		Select("COALESCE(MAX(version), 0)").Scan(&maxVersion).Error; err != nil {
		log.Error().Err(err).Msg("computing next version number")
		httpx.WriteError(w, http.StatusInternalServerError, "could not start upload")
		return
	}

	newFileID := uuid.New()
	storageKey := fmt.Sprintf("users/%s/%s/%s", userID, newFileID, current.Name)

	newVersion := models.File{
		ID:         newFileID,
		Name:       current.Name,
		UserID:     userID,
		FolderID:   current.FolderID,
		StorageKey: storageKey,
		SizeBytes:  req.SizeBytes,
		MimeType:   req.MimeType,
		Status:     models.FileStatusPending,
		Version:    maxVersion + 1,
		ParentID:   &root,
		IsCurrent:  true,
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.File{}).
			Where("user_id = ? AND (id = ? OR parent_id = ?)", userID, root, root).
			Update("is_current", false).Error; err != nil {
			return fmt.Errorf("superseding current version: %w", err)
		}
		return tx.Create(&newVersion).Error
	}); err != nil {
		log.Error().Err(err).Msg("creating new file version")
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
		FileID:    newFileID,
		UploadURL: uploadURL.String(),
		ExpiresAt: time.Now().Add(presignExpiry),
	})
}
