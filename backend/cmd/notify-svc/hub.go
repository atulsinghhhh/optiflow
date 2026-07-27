package main

import (
	"context"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/models"
)

// hub tracks live WebSocket connections per user, in-process. This is single-
// instance only — running more than one notify-svc replica would need a shared
// fan-out layer (e.g. Redis pub/sub) so a push lands on whichever instance holds
// the recipient's connection. That's a v2 concern (see plan.md's NATS/event
// fan-out line); not needed until notify-svc actually scales beyond one process.
type hub struct {
	mu    sync.RWMutex
	conns map[uuid.UUID]map[*websocket.Conn]struct{}
}

func newHub() *hub {
	return &hub{conns: make(map[uuid.UUID]map[*websocket.Conn]struct{})}
}

func (h *hub) register(userID uuid.UUID, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns[userID] == nil {
		h.conns[userID] = make(map[*websocket.Conn]struct{})
	}
	h.conns[userID][c] = struct{}{}
}

func (h *hub) unregister(userID uuid.UUID, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns[userID], c)
	if len(h.conns[userID]) == 0 {
		delete(h.conns, userID)
	}
}

// push delivers a notification to every connection the user currently has
// open. If they have none, this is a no-op — the notification still exists in
// the database for the polling endpoint to pick up.
func (h *hub) push(ctx context.Context, userID uuid.UUID, n models.Notification) {
	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.conns[userID]))
	for c := range h.conns[userID] {
		conns = append(conns, c)
	}
	h.mu.RUnlock()

	for _, c := range conns {
		if err := wsjson.Write(ctx, c, n); err != nil {
			log.Error().Err(err).Str("user_id", userID.String()).Msg("pushing notification over websocket")
		}
	}
}
