package main

import (
	"encoding/json"
	"net/http"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"github.com/atulsinghhhh/optiflow/internal/auth"
	"github.com/atulsinghhhh/optiflow/internal/httpx"
	"github.com/atulsinghhhh/optiflow/internal/middleware"
	"github.com/atulsinghhhh/optiflow/internal/models"
)

type handler struct {
	db             *gorm.DB
	hub            *hub
	jwtSecret      []byte
	internalSecret string
	originPattern  string
}

func (h *handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	var notifications []models.Notification
	if err := h.db.Where("user_id = ?", userID).Order("created_at desc").Limit(50).Find(&notifications).Error; err != nil {
		log.Error().Err(err).Msg("listing notifications")
		httpx.WriteError(w, http.StatusInternalServerError, "could not list notifications")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, notifications)
}

func (h *handler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid notification id")
		return
	}

	result := h.db.Model(&models.Notification{}).Where("id = ? AND user_id = ?", id, userID).Update("read", true)
	if result.Error != nil {
		log.Error().Err(result.Error).Msg("marking notification read")
		httpx.WriteError(w, http.StatusInternalServerError, "could not update notification")
		return
	}
	if result.RowsAffected == 0 {
		httpx.WriteError(w, http.StatusNotFound, "notification not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ws upgrades to a WebSocket and streams live notifications for the
// authenticated user. Browsers can't set an Authorization header on the
// handshake request, so the access token comes via ?token= instead —
// middleware.RequireAuth (header-based) doesn't apply here.
func (h *handler) ws(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "missing token query parameter")
		return
	}

	claims, err := auth.ParseToken(token, h.jwtSecret)
	if err != nil || claims.Type != auth.AccessToken {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}
	userID := claims.UserID

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{h.originPattern},
	})
	if err != nil {
		log.Error().Err(err).Msg("accepting websocket connection")
		return
	}
	defer conn.CloseNow()

	h.hub.register(userID, conn)
	defer h.hub.unregister(userID, conn)

	// This connection is push-only (server -> client); CloseRead handles
	// incoming control frames (pings, the client's close) in the background
	// and cancels ctx once the connection ends, which is all we need to block on.
	ctx := conn.CloseRead(r.Context())
	<-ctx.Done()
}

type internalNotifyRequest struct {
	UserID    uuid.UUID `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	ActionURL *string   `json:"action_url,omitempty"`
}

// internalNotify is called by other backend services (not browsers) to create
// and push a notification. Gated by a shared secret, not JWT — the caller is
// a service, not a signed-in user.
func (h *handler) internalNotify(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-Secret") != h.internalSecret {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid internal secret")
		return
	}

	var req internalNotifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == uuid.Nil || req.Title == "" || req.Message == "" {
		httpx.WriteError(w, http.StatusBadRequest, "user_id, title, and message are required")
		return
	}

	notificationType := models.NotificationType(req.Type)
	switch notificationType {
	case models.NotificationTypeSystem, models.NotificationTypeStorage, models.NotificationTypeShare:
	default:
		notificationType = models.NotificationTypeSystem
	}

	n := models.Notification{
		UserID:    req.UserID,
		Type:      notificationType,
		Title:     req.Title,
		Message:   req.Message,
		ActionURL: req.ActionURL,
	}
	if err := h.db.Create(&n).Error; err != nil {
		log.Error().Err(err).Msg("creating notification")
		httpx.WriteError(w, http.StatusInternalServerError, "could not create notification")
		return
	}

	if err := h.hub.publish(r.Context(), req.UserID, n); err != nil {
		// The notification is already persisted — a fan-out hiccup means
		// connected clients miss the live push, not that the notification is
		// lost; they'll still see it via GET /notifications.
		log.Error().Err(err).Str("user_id", req.UserID.String()).Msg("publishing notification to redis")
	}

	httpx.WriteJSON(w, http.StatusCreated, n)
}
