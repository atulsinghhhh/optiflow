package main

import (
	"encoding/json"
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

type handler struct {
	db *gorm.DB
}

type folderRequest struct {
	Name     string  `json:"name"`
	ParentID *string `json:"parent_id"`
}

type folderResponse struct {
	models.Folder
	Children []models.Folder `json:"children,omitempty"`
	Files    []models.File   `json:"files,omitempty"`
}

// resolveOwnedFolder looks up a folder by ID scoped to userID, returning 404-shaped
// errors as gorm.ErrRecordNotFound so callers can respond uniformly regardless of
// whether the folder doesn't exist or simply isn't owned by this user.
func (h *handler) resolveOwnedFolder(userID, folderID uuid.UUID) (models.Folder, error) {
	var folder models.Folder
	err := h.db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error
	return folder, err
}

// isDescendant reports whether candidateID is folderID itself or one of its
// descendants — used to reject moves that would create a cycle in the folder tree.
func (h *handler) isDescendant(userID, folderID, candidateID uuid.UUID) (bool, error) {
	current := candidateID
	for {
		if current == folderID {
			return true, nil
		}
		var folder models.Folder
		err := h.db.Select("parent_id").Where("id = ? AND user_id = ?", current, userID).First(&folder).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if folder.ParentID == nil {
			return false, nil
		}
		current = *folder.ParentID
	}
}

func (h *handler) createFolder(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var req folderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}

	folder := models.Folder{Name: req.Name, UserID: userID}

	if req.ParentID != nil {
		parentID, err := uuid.Parse(*req.ParentID)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid parent_id")
			return
		}
		if _, err := h.resolveOwnedFolder(userID, parentID); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "parent folder not found")
			return
		}
		folder.ParentID = &parentID
	}

	if err := h.db.Create(&folder).Error; err != nil {
		log.Error().Err(err).Msg("creating folder")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create folder")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, folder)
}

func (h *handler) listFolders(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	query := h.db.Where("user_id = ?", userID)
	if parentParam := r.URL.Query().Get("parent_id"); parentParam != "" {
		parentID, err := uuid.Parse(parentParam)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid parent_id")
			return
		}
		query = query.Where("parent_id = ?", parentID)
	} else {
		query = query.Where("parent_id IS NULL")
	}

	var folders []models.Folder
	if err := query.Order("name").Find(&folders).Error; err != nil {
		log.Error().Err(err).Msg("listing folders")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list folders")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, folders)
}

func (h *handler) getFolder(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid folder id")
		return
	}

	folder, err := h.resolveOwnedFolder(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "folder not found")
		return
	}

	resp := folderResponse{Folder: folder}
	if err := h.db.Where("user_id = ? AND parent_id = ?", userID, id).Order("name").Find(&resp.Children).Error; err != nil {
		log.Error().Err(err).Msg("listing child folders")
		httpx.WriteError(w, http.StatusInternalServerError, "could not load folder")
		return
	}
	if err := h.db.Where("user_id = ? AND folder_id = ?", userID, id).Order("name").Find(&resp.Files).Error; err != nil {
		log.Error().Err(err).Msg("listing folder files")
		httpx.WriteError(w, http.StatusInternalServerError, "could not load folder")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) updateFolder(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid folder id")
		return
	}

	folder, err := h.resolveOwnedFolder(userID, id)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "folder not found")
		return
	}

	var req folderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != "" {
		folder.Name = req.Name
	}

	if req.ParentID != nil {
		if *req.ParentID == "" {
			folder.ParentID = nil
		} else {
			parentID, err := uuid.Parse(*req.ParentID)
			if err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "invalid parent_id")
				return
			}
			if _, err := h.resolveOwnedFolder(userID, parentID); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "parent folder not found")
				return
			}
			cyclic, err := h.isDescendant(userID, id, parentID)
			if err != nil {
				log.Error().Err(err).Msg("checking folder move for cycles")
				httpx.WriteError(w, http.StatusInternalServerError, "could not move folder")
				return
			}
			if cyclic {
				httpx.WriteError(w, http.StatusBadRequest, "cannot move a folder into itself or one of its descendants")
				return
			}
			folder.ParentID = &parentID
		}
	}

	if err := h.db.Save(&folder).Error; err != nil {
		log.Error().Err(err).Msg("updating folder")
		httpx.WriteError(w, http.StatusInternalServerError, "could not update folder")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, folder)
}

func (h *handler) deleteFolder(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid folder id")
		return
	}

	if _, err := h.resolveOwnedFolder(userID, id); err != nil {
		httpx.WriteError(w, http.StatusNotFound, "folder not found")
		return
	}

	if err := h.deleteFolderRecursive(userID, id); err != nil {
		log.Error().Err(err).Msg("deleting folder")
		httpx.WriteError(w, http.StatusInternalServerError, "could not delete folder")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// deleteFolderRecursive deletes a folder along with every descendant folder and
// file, all within a single transaction so a partial failure can't leave orphans.
func (h *handler) deleteFolderRecursive(userID, folderID uuid.UUID) error {
	return h.db.Transaction(func(tx *gorm.DB) error {
		return deleteFolderTree(tx, userID, folderID)
	})
}

func deleteFolderTree(tx *gorm.DB, userID, folderID uuid.UUID) error {
	var children []models.Folder
	if err := tx.Where("user_id = ? AND parent_id = ?", userID, folderID).Find(&children).Error; err != nil {
		return err
	}
	for _, child := range children {
		if err := deleteFolderTree(tx, userID, child.ID); err != nil {
			return err
		}
	}
	if err := tx.Where("user_id = ? AND folder_id = ?", userID, folderID).Delete(&models.File{}).Error; err != nil {
		return err
	}
	return tx.Where("id = ? AND user_id = ?", folderID, userID).Delete(&models.Folder{}).Error
}
