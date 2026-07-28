package main

import (
	"net/http"
	"strings"

	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type fileStatsResponse struct {
	TotalFiles   int            `json:"total_files"`
	TotalBytes   int64          `json:"total_bytes"`
	StatusCounts map[string]int `json:"status_counts"`
	TypeCounts   map[string]int `json:"type_counts"`
}

func categorizeMime(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "Images"
	case strings.HasPrefix(mimeType, "video/"):
		return "Video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "Audio"
	case strings.Contains(mimeType, "pdf"), strings.Contains(mimeType, "word"), strings.Contains(mimeType, "document"):
		return "Documents"
	default:
		return "Other"
	}
}

// fileStats aggregates every file the user owns across the whole folder tree —
// unlike listFiles, which only lists one folder level at a time, this walks
// the full account so the dashboard can show real account-wide totals.
func (h *handler) fileStats(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var files []models.File
	if err := h.db.Select("size_bytes", "mime_type", "status").Where("user_id = ?", userID).Find(&files).Error; err != nil {
		log.Error().Err(err).Msg("aggregating file stats")
		httpx.WriteError(w, http.StatusInternalServerError, "could not load stats")
		return
	}

	resp := fileStatsResponse{
		StatusCounts: make(map[string]int),
		TypeCounts:   make(map[string]int),
	}
	for _, f := range files {
		resp.TotalFiles++
		resp.TotalBytes += f.SizeBytes
		resp.StatusCounts[string(f.Status)]++
		resp.TypeCounts[categorizeMime(f.MimeType)]++
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}
