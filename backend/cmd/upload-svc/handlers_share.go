package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type shareDownloadRequest struct {
	Password string `json:"password"`
}

// resolveActiveShare loads a share by token and validates it hasn't expired or
// hit its download limit. Mirrors api-svc's identical check (each service owns
// its own copy since neither depends on the other's internal packages), so
// the two never drift on what counts as "still valid".
func resolveActiveShare(db *gorm.DB, token string) (models.Share, error) {
	var share models.Share
	if err := db.Where("token = ?", token).First(&share).Error; err != nil {
		return models.Share{}, err
	}
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		return models.Share{}, gorm.ErrRecordNotFound
	}
	if share.MaxDownloads != nil && share.DownloadCount >= *share.MaxDownloads {
		return models.Share{}, gorm.ErrRecordNotFound
	}
	return share, nil
}

// shareDownloadURL is the public (unauthenticated) counterpart to
// downloadURL: it resolves a share token instead of a JWT-owned file id,
// checks the share's password/expiry/limit, and only then hands back a
// presigned MinIO URL. Download-count increments here, not on metadata
// resolution in api-svc, since only an actual download should count against
// the limit.
func (h *handler) shareDownloadURL(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")

	share, err := resolveActiveShare(h.db, token)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "share link not found or expired")
			return
		}
		log.Error().Err(err).Msg("resolving share")
		httpx.WriteError(w, http.StatusInternalServerError, "could not resolve share")
		return
	}

	if share.PasswordHash != nil {
		var req shareDownloadRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := auth.VerifyPassword(*share.PasswordHash, req.Password); err != nil {
			httpx.WriteError(w, http.StatusUnauthorized, "incorrect password")
			return
		}
	}

	var file models.File
	if err := h.db.Where("id = ?", share.FileID).First(&file).Error; err != nil {
		httpx.WriteError(w, http.StatusNotFound, "shared file no longer exists")
		return
	}
	if file.Status != models.FileStatusReady {
		httpx.WriteError(w, http.StatusConflict, "file is not ready for download")
		return
	}

	u, err := h.storage.PresignedGetURL(r.Context(), file.StorageKey, downloadExpiry)
	if err != nil {
		log.Error().Err(err).Msg("presigning share download url")
		httpx.WriteError(w, http.StatusInternalServerError, "could not build download url")
		return
	}

	if err := h.db.Model(&models.Share{}).Where("id = ?", share.ID).
		Update("download_count", gorm.Expr("download_count + 1")).Error; err != nil {
		log.Error().Err(err).Str("share_id", share.ID.String()).Msg("incrementing share download count")
	}

	httpx.WriteJSON(w, http.StatusOK, downloadURLResponse{
		URL:       u.String(),
		ExpiresAt: time.Now().Add(downloadExpiry),
	})
}
