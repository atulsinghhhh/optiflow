package main

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

// lineageRootID returns the ID that ties every version of the same logical
// file together — the file's own ID if it's the root (ParentID nil), or its
// ParentID otherwise.
func lineageRootID(file models.File) uuid.UUID {
	if file.ParentID != nil {
		return *file.ParentID
	}
	return file.ID
}

// lineageFiles loads every version of the logical file rooted at root,
// newest first.
func lineageFiles(tx *gorm.DB, userID, root uuid.UUID) ([]models.File, error) {
	var files []models.File
	err := tx.Where("user_id = ? AND (id = ? OR parent_id = ?)", userID, root, root).
		Order("version desc").Find(&files).Error
	return files, err
}

// listFileVersions returns the full version history of a file, newest first.
func (h *handler) listFileVersions(w http.ResponseWriter, r *http.Request) {
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

	versions, err := lineageFiles(h.db, userID, lineageRootID(file))
	if err != nil {
		log.Error().Err(err).Msg("listing file versions")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list versions")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, versions)
}

// restoreFileVersion makes an older version the current one again. This never
// deletes or duplicates rows — it just moves the is_current flag, so the
// storage key (and thus the MinIO object) for every version stays put.
func (h *handler) restoreFileVersion(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}
	versionID, err := uuid.Parse(chi.URLParam(r, "versionId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid version id")
		return
	}

	file, err := h.resolveOwnedFile(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}
	root := lineageRootID(file)

	var target models.File
	if err := h.db.Where("id = ? AND user_id = ?", versionID, userID).First(&target).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "version not found")
			return
		}
		log.Error().Err(err).Msg("looking up version to restore")
		httpx.WriteError(w, http.StatusInternalServerError, "could not restore version")
		return
	}
	if lineageRootID(target) != root {
		httpx.WriteError(w, http.StatusBadRequest, "version does not belong to this file")
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.File{}).
			Where("user_id = ? AND (id = ? OR parent_id = ?)", userID, root, root).
			Update("is_current", false).Error; err != nil {
			return err
		}
		return tx.Model(&models.File{}).Where("id = ?", target.ID).Update("is_current", true).Error
	}); err != nil {
		log.Error().Err(err).Msg("restoring file version")
		httpx.WriteError(w, http.StatusInternalServerError, "could not restore version")
		return
	}

	target.IsCurrent = true
	httpx.WriteJSON(w, http.StatusOK, target)
}
