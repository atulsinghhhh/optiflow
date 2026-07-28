package main

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/atulsinghhhh/optiflow/internal/models"
)

// notifyChannel is the single Redis pub/sub channel every notify-svc replica
// subscribes to. A broadcast-and-filter design (one shared channel, each
// instance only delivers to the local connections it happens to hold) rather
// than per-user channels, since it needs no dynamic subscribe/unsubscribe as
// users connect and disconnect — simple, and plenty for the connection counts
// a handful of notify-svc replicas would ever see.
const notifyChannel = "streamvault:notifications"

type notifyEnvelope struct {
	UserID       uuid.UUID           `json:"user_id"`
	Notification models.Notification `json:"notification"`
}

// hub tracks live WebSocket connections per user, in-process, and fans
// notifications out via Redis so every notify-svc replica — not just the one
// that happens to hold a given user's connection — learns about them. publish
// sends to Redis; deliverLocal (invoked for every message this instance
// receives back from its own subscription, including ones it published
// itself) does the actual local websocket write. That split is what makes a
// single-instance deploy and a multi-replica deploy work through the exact
// same code path.
type hub struct {
	mu    sync.RWMutex
	conns map[uuid.UUID]map[*websocket.Conn]struct{}
	rdb   *redis.Client
}

func newHub(rdb *redis.Client) *hub {
	return &hub{conns: make(map[uuid.UUID]map[*websocket.Conn]struct{}), rdb: rdb}
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

// publish fans a notification out to every notify-svc replica via Redis.
// Never blocks on a slow subscriber — it's a fire-and-forget PUBLISH.
func (h *hub) publish(ctx context.Context, userID uuid.UUID, n models.Notification) error {
	payload, err := json.Marshal(notifyEnvelope{UserID: userID, Notification: n})
	if err != nil {
		return err
	}
	return h.rdb.Publish(ctx, notifyChannel, payload).Err()
}

// deliverLocal writes a notification to every connection *this* instance
// holds for the user. If it holds none, this is a no-op — the notification
// still exists in the database for the polling endpoint and other replicas'
// connected clients to pick up.
func (h *hub) deliverLocal(ctx context.Context, userID uuid.UUID, n models.Notification) {
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

// subscribeLoop runs for the life of the process, delivering every message
// this instance receives on notifyChannel (from any replica, including
// itself) to whatever local connections match. Reconnection/backoff on
// subscribe failures is handled by the underlying redis client already.
func (h *hub) subscribeLoop(ctx context.Context) {
	sub := h.rdb.Subscribe(ctx, notifyChannel)
	defer sub.Close()

	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var env notifyEnvelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				log.Error().Err(err).Msg("decoding notification pub/sub message")
				continue
			}
			h.deliverLocal(ctx, env.UserID, env.Notification)
		}
	}
}
