package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type fileUpdateRequest struct {
	Name     *string `json:"name"`
	FolderID *string `json:"folder_id"`
}

func (h *handler) resolveOwnedFile(userID, fileID uuid.UUID) (models.File, error) {
	var file models.File
	err := h.db.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error
	return file, err
}

func (h *handler) listFiles(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	// is_current excludes superseded versions from listings — they're only
	// reachable via GET /files/{id}/versions, not the regular file browser.
	query := h.db.Where("user_id = ? AND is_current = ?", userID, true)
	if folderParam := r.URL.Query().Get("folder_id"); folderParam != "" {
		folderID, err := uuid.Parse(folderParam)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid folder_id")
			return
		}
		query = query.Where("folder_id = ?", folderID)
	} else {
		query = query.Where("folder_id IS NULL")
	}

	var files []models.File
	if err := query.Order("name").Find(&files).Error; err != nil {
		log.Error().Err(err).Msg("listing files")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list files")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, files)
}

func (h *handler) getFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	file, err := h.resolveOwnedFile(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, file)
}

func (h *handler) updateFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	file, err := h.resolveOwnedFile(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}

	var req fileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		if *req.Name == "" {
			httpx.WriteError(w, http.StatusBadRequest, "name cannot be empty")
			return
		}
		file.Name = *req.Name
	}

	if req.FolderID != nil {
		if *req.FolderID == "" {
			file.FolderID = nil
		} else {
			folderID, err := uuid.Parse(*req.FolderID)
			if err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "invalid folder_id")
				return
			}
			if _, err := h.resolveOwnedFolder(userID, folderID); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "folder not found")
				return
			}
			file.FolderID = &folderID
		}
	}

	if err := h.db.Save(&file).Error; err != nil {
		log.Error().Err(err).Msg("updating file")
		httpx.WriteError(w, http.StatusInternalServerError, "could not update file")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, file)
}

// deleteFile removes every version of the file (its whole lineage, not just
// the current row — otherwise old versions would become unreachable orphans
// in both Postgres and MinIO, since they're only ever found by walking from
// the current row), their share links, and best-effort cleans up their MinIO
// object(s). Storage cleanup failures are logged loudly but never block the
// delete — a stray orphaned object is recoverable later, a file the user
// can't delete because of a storage hiccup is not.
func (h *handler) deleteFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	file, err := h.resolveOwnedFile(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}
	root := lineageRootID(file)

	var versions []models.File
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var err error
		versions, err = lineageFiles(tx, userID, root)
		if err != nil {
			return fmt.Errorf("loading versions: %w", err)
		}

		ids := make([]uuid.UUID, len(versions))
		for i, v := range versions {
			ids[i] = v.ID
		}

		if err := tx.Where("file_id IN ? AND user_id = ?", ids, userID).Delete(&models.Share{}).Error; err != nil {
			return fmt.Errorf("deleting shares: %w", err)
		}
		return tx.Where("id IN ? AND user_id = ?", ids, userID).Delete(&models.File{}).Error
	}); err != nil {
		log.Error().Err(err).Msg("deleting file")
		httpx.WriteError(w, http.StatusInternalServerError, "could not delete file")
		return
	}

	for _, v := range versions {
		h.cleanupFileObjects(r.Context(), v)
	}

	w.WriteHeader(http.StatusNoContent)
}

// cleanupFileObjects removes every MinIO object associated with a file: the
// original, its thumbnail/poster, and — for videos — the entire hls/{id}/
// prefix of playlists and segments.
func (h *handler) cleanupFileObjects(ctx context.Context, file models.File) {
	keys := []string{file.StorageKey}
	if file.ThumbnailKey != nil {
		keys = append(keys, *file.ThumbnailKey)
	}
	if file.PlaylistKey != nil {
		hlsKeys, err := h.storage.ListObjects(ctx, fmt.Sprintf("hls/%s/", file.ID))
		if err != nil {
			log.Error().Err(err).Str("file_id", file.ID.String()).Msg("listing hls objects for cleanup")
		} else {
			keys = append(keys, hlsKeys...)
		}
	}

	for _, key := range keys {
		if err := h.storage.RemoveObject(ctx, key); err != nil {
			log.Error().Err(err).Str("file_id", file.ID.String()).Str("key", key).Msg("removing storage object")
		}
	}
}
