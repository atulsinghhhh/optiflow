package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

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

	query := h.db.Where("user_id = ?", userID)
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

// deleteFile removes the file's metadata row. It does not delete the underlying
// MinIO object — upload-svc/object lifecycle management isn't wired up yet
// (Phase v1, see plan.md), so deletes here are metadata-only for now.
func (h *handler) deleteFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid file id")
		return
	}

	if _, err := h.resolveOwnedFile(userID, id); err != nil {
		httpx.WriteError(w, http.StatusNotFound, "file not found")
		return
	}

	if err := h.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.File{}).Error; err != nil {
		log.Error().Err(err).Msg("deleting file")
		httpx.WriteError(w, http.StatusInternalServerError, "could not delete file")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
