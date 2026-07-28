package main

import (
	"errors"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

// hlsAsset streams a single HLS asset (master playlist, variant playlist, or
// .ts segment) for a video the caller owns, straight from MinIO. This is the
// chosen answer to the "segment-level presigning vs public-read bucket
// policy" question left open in plan.md: neither — every asset is served
// through this authenticated proxy instead, so hls.js just needs its xhrSetup
// to attach the same bearer token used everywhere else in the app. Playlists
// reference sibling assets by relative name (e.g. "480p.m3u8", "480p_000.ts"),
// so hls.js resolves them against this same authenticated base URL with no
// URL rewriting required.
func (h *handler) hlsAsset(w http.ResponseWriter, r *http.Request) {
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
		log.Error().Err(err).Msg("looking up file for hls asset")
		httpx.WriteError(w, http.StatusInternalServerError, "could not load video")
		return
	}
	if file.PlaylistKey == nil {
		httpx.WriteError(w, http.StatusNotFound, "no hls playlist for this file")
		return
	}

	asset := chi.URLParam(r, "*")
	cleaned := path.Clean("/" + asset)
	if cleaned == "/" || strings.Contains(cleaned, "..") {
		httpx.WriteError(w, http.StatusBadRequest, "invalid asset path")
		return
	}

	key := "hls/" + file.ID.String() + cleaned

	obj, err := h.storage.GetObject(r.Context(), key)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "asset not found")
		return
	}
	defer obj.Close()

	switch path.Ext(cleaned) {
	case ".m3u8":
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	case ".ts":
		w.Header().Set("Content-Type", "video/mp2t")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	if _, err := io.Copy(w, obj); err != nil {
		log.Error().Err(err).Str("key", key).Msg("streaming hls asset")
	}
}
