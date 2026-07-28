package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type shareCreateRequest struct {
	ExpiresInHours *int    `json:"expires_in_hours"`
	Password       *string `json:"password"`
	MaxDownloads   *int    `json:"max_downloads"`
}

type shareResponse struct {
	models.Share
	FileName         string `json:"file_name"`
	RequiresPassword bool   `json:"requires_password"`
}

func toShareResponse(share models.Share, fileName string) shareResponse {
	return shareResponse{Share: share, FileName: fileName, RequiresPassword: share.PasswordHash != nil}
}

func generateShareToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generating share token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// createShare issues a new public token link for a file the caller owns.
func (h *handler) createShare(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	fileID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	file, err := h.resolveOwnedFile(userID, fileID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}

	var req shareCreateRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	token, err := generateShareToken()
	if err != nil {
		log.Error().Err(err).Msg("generating share token")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create share")
		return
	}

	share := models.Share{
		FileID: file.ID,
		UserID: userID,
		Token:  token,
	}

	if req.ExpiresInHours != nil {
		if *req.ExpiresInHours <= 0 {
			httpx.WriteError(w, http.StatusBadRequest, "expires_in_hours must be positive")
			return
		}
		expiry := time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
		share.ExpiresAt = &expiry
	}

	if req.MaxDownloads != nil {
		if *req.MaxDownloads <= 0 {
			httpx.WriteError(w, http.StatusBadRequest, "max_downloads must be positive")
			return
		}
		share.MaxDownloads = req.MaxDownloads
	}

	if req.Password != nil && *req.Password != "" {
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			log.Error().Err(err).Msg("hashing share password")
			httpx.WriteError(w, http.StatusInternalServerError, "could not create share")
			return
		}
		share.PasswordHash = &hash
	}

	if err := h.db.Create(&share).Error; err != nil {
		log.Error().Err(err).Msg("creating share")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create share")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, toShareResponse(share, file.Name))
}

// listFileShares lists every share link for a single file the caller owns.
func (h *handler) listFileShares(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	fileID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	file, err := h.resolveOwnedFile(userID, fileID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}

	var shares []models.Share
	if err := h.db.Where("file_id = ? AND user_id = ?", fileID, userID).Order("created_at desc").Find(&shares).Error; err != nil {
		log.Error().Err(err).Msg("listing file shares")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list shares")
		return
	}

	resp := make([]shareResponse, len(shares))
	for i, s := range shares {
		resp[i] = toShareResponse(s, file.Name)
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// listShares lists every share link the caller has created, across all files.
func (h *handler) listShares(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var shares []models.Share
	if err := h.db.Where("user_id = ?", userID).Order("created_at desc").Find(&shares).Error; err != nil {
		log.Error().Err(err).Msg("listing shares")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list shares")
		return
	}

	fileNames := make(map[uuid.UUID]string)
	resp := make([]shareResponse, len(shares))
	for i, s := range shares {
		name, ok := fileNames[s.FileID]
		if !ok {
			var file models.File
			if err := h.db.Select("name").Where("id = ?", s.FileID).First(&file).Error; err == nil {
				name = file.Name
			} else {
				name = "(deleted file)"
			}
			fileNames[s.FileID] = name
		}
		resp[i] = toShareResponse(s, name)
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// deleteShare revokes a share link the caller owns.
func (h *handler) deleteShare(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid share id")
		return
	}

	res := h.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Share{})
	if res.Error != nil {
		log.Error().Err(res.Error).Msg("deleting share")
		httpx.WriteError(w, http.StatusInternalServerError, "could not delete share")
		return
	}
	if res.RowsAffected == 0 {
		httpx.WriteError(w, http.StatusNotFound, "share not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type publicShareResponse struct {
	FileName         string `json:"file_name"`
	SizeBytes        int64  `json:"size_bytes"`
	MimeType         string `json:"mime_type"`
	RequiresPassword bool   `json:"requires_password"`
	HasThumbnail     bool   `json:"has_thumbnail"`
}

// resolveActiveShare loads a share by token and validates it hasn't expired or
// hit its download limit — shared by the public metadata and download-count
// paths so the rules can't drift between them.
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

// getPublicShare resolves a share token to file metadata. No auth required —
// this is the whole point of a public share link — so it deliberately never
// exposes the owner's identity, only what's needed to render the share page.
func (h *handler) getPublicShare(w http.ResponseWriter, r *http.Request) {
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

	var file models.File
	if err := h.db.Where("id = ?", share.FileID).First(&file).Error; err != nil {
		httpx.WriteError(w, http.StatusNotFound, "shared file no longer exists")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, publicShareResponse{
		FileName:         file.Name,
		SizeBytes:        file.SizeBytes,
		MimeType:         file.MimeType,
		RequiresPassword: share.PasswordHash != nil,
		HasThumbnail:     file.ThumbnailKey != nil,
	})
}
