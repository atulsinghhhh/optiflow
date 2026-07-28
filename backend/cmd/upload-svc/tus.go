package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/tus/tusd/v2/pkg/filestore"
	tusdhandler "github.com/tus/tusd/v2/pkg/handler"
	"github.com/tus/tusd/v2/pkg/memorylocker"

	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
	"github.com/atulsinghhhh/optiflow/internal/queue"
)

// newTusHandler builds a tus 1.0 resumable-upload endpoint. Chunks land on
// local disk via tusd's filestore (see plan.md's decision note on why local
// staging over direct-to-MinIO multipart), and once an upload finishes,
// finishTusUpload pushes the assembled file into MinIO and processes it
// exactly like a regular single-PUT upload: same File row shape, same
// thumbnail/transcode enqueue, same notifications.
func (h *handler) newTusHandler(dataDir string) (*tusdhandler.Handler, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("creating tus data dir: %w", err)
	}

	store := filestore.New(dataDir)
	locker := memorylocker.New()
	composer := tusdhandler.NewStoreComposer()
	store.UseIn(composer)
	locker.UseIn(composer)

	cfg := tusdhandler.Config{
		StoreComposer:         composer,
		BasePath:              "/uploads/tus/",
		NotifyCompleteUploads: true,
		// CORS is already handled by the outer go-chi/cors middleware that
		// wraps every route in this service — letting tusd's own CORS layer
		// run too would just produce duplicate/conflicting headers.
		Cors:                    &tusdhandler.CorsConfig{Disable: true},
		PreUploadCreateCallback: h.tusPreCreate,
	}

	tusHandler, err := tusdhandler.NewHandler(cfg)
	if err != nil {
		return nil, fmt.Errorf("creating tus handler: %w", err)
	}

	go func() {
		for event := range tusHandler.CompleteUploads {
			h.finishTusUpload(context.Background(), event)
		}
	}()

	return tusHandler, nil
}

// tusPreCreate runs before a tus upload is accepted. It authenticates the
// caller (via the same request context middleware.RequireAuth already
// populated for every other /uploads route), validates the client-supplied
// metadata and quota exactly like the presigned-PUT path's presign handler
// does, and stamps the owning user onto the upload's metadata so
// finishTusUpload can attribute it later without needing request context —
// which no longer exists by the time an upload actually completes.
func (h *handler) tusPreCreate(hook tusdhandler.HookEvent) (tusdhandler.HTTPResponse, tusdhandler.FileInfoChanges, error) {
	userID, ok := middleware.UserIDFromContext(hook.Context)
	if !ok {
		return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
			tusdhandler.NewError("ERR_UNAUTHENTICATED", "missing authenticated user", http.StatusUnauthorized)
	}

	name := firstNonEmpty(hook.Upload.MetaData["filename"], hook.Upload.MetaData["name"])
	if name == "" {
		return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
			tusdhandler.NewError("ERR_INVALID_METADATA", "filename metadata is required", http.StatusBadRequest)
	}

	if folderIDStr := hook.Upload.MetaData["folder_id"]; folderIDStr != "" {
		folderID, err := uuid.Parse(folderIDStr)
		if err != nil {
			return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
				tusdhandler.NewError("ERR_INVALID_METADATA", "invalid folder_id", http.StatusBadRequest)
		}
		var folder models.Folder
		if err := h.db.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
			return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
				tusdhandler.NewError("ERR_INVALID_METADATA", "folder not found", http.StatusBadRequest)
		}
	}

	if err := h.checkQuota(userID, hook.Upload.Size); err != nil {
		if errors.Is(err, errQuotaExceeded) {
			return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
				tusdhandler.NewError("ERR_QUOTA_EXCEEDED", err.Error(), http.StatusRequestEntityTooLarge)
		}
		log.Error().Err(err).Msg("checking storage quota for tus upload")
		return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{},
			tusdhandler.NewError("ERR_INTERNAL", "could not start upload", http.StatusInternalServerError)
	}

	meta := tusdhandler.MetaData{}
	for k, v := range hook.Upload.MetaData {
		meta[k] = v
	}
	meta["user_id"] = userID.String()

	return tusdhandler.HTTPResponse{}, tusdhandler.FileInfoChanges{MetaData: meta}, nil
}

// finishTusUpload runs outside any HTTP request (triggered by tusd's
// CompleteUploads channel), so it has to derive everything it needs from the
// upload's own persisted metadata rather than request context.
func (h *handler) finishTusUpload(ctx context.Context, event tusdhandler.HookEvent) {
	meta := event.Upload.MetaData

	userID, err := uuid.Parse(meta["user_id"])
	if err != nil {
		log.Error().Str("upload_id", event.Upload.ID).Msg("tus upload finished with no valid user_id metadata")
		return
	}

	name := firstNonEmpty(meta["filename"], meta["name"], event.Upload.ID)
	mimeType := meta["filetype"]
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	var folderID *uuid.UUID
	if fid := meta["folder_id"]; fid != "" {
		if parsed, err := uuid.Parse(fid); err == nil {
			folderID = &parsed
		}
	}

	dataPath, ok := event.Upload.Storage[filestore.StorageKeyPath]
	if !ok || dataPath == "" {
		log.Error().Str("upload_id", event.Upload.ID).Msg("tus upload finished with no storage path")
		return
	}

	f, err := os.Open(dataPath)
	if err != nil {
		log.Error().Err(err).Str("upload_id", event.Upload.ID).Msg("opening finished tus upload")
		return
	}
	defer f.Close()

	fileID := uuid.New()
	storageKey := fmt.Sprintf("users/%s/%s/%s", userID, fileID, name)

	if err := h.storage.PutObject(ctx, storageKey, f, event.Upload.Size, mimeType); err != nil {
		log.Error().Err(err).Str("upload_id", event.Upload.ID).Msg("uploading finished tus data to storage")
		return
	}

	isImage := strings.HasPrefix(mimeType, "image/")
	isVideo := strings.HasPrefix(mimeType, "video/")
	status := models.FileStatusReady
	if isImage || isVideo {
		status = models.FileStatusProcessing
	}

	file := models.File{
		ID:         fileID,
		Name:       name,
		UserID:     userID,
		FolderID:   folderID,
		StorageKey: storageKey,
		SizeBytes:  event.Upload.Size,
		MimeType:   mimeType,
		Status:     status,
		Version:    1,
		IsCurrent:  true,
	}
	if err := h.db.Create(&file).Error; err != nil {
		log.Error().Err(err).Str("upload_id", event.Upload.ID).Msg("creating file record for finished tus upload")
		return
	}

	switch {
	case isImage:
		task, err := queue.NewImageThumbnailTask(queue.ImageThumbnailPayload{FileID: file.ID, StorageKey: file.StorageKey})
		h.enqueueOrLog(task, err, "image thumbnail", file.ID)
	case isVideo:
		task, err := queue.NewVideoTranscodeTask(queue.VideoTranscodePayload{FileID: file.ID, StorageKey: file.StorageKey})
		h.enqueueOrLog(task, err, "video transcode", file.ID)
	}

	// tusd's filestore never cleans up finished uploads on its own (see its
	// package doc) — the bytes now live in MinIO, so the local staging files
	// are just disk usage waiting to be reclaimed.
	if err := os.Remove(dataPath); err != nil {
		log.Error().Err(err).Str("upload_id", event.Upload.ID).Msg("removing finished tus data file")
	}
	if err := os.Remove(dataPath + ".info"); err != nil {
		log.Error().Err(err).Str("upload_id", event.Upload.ID).Msg("removing tus upload info file")
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
