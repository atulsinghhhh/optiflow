package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type Client struct {
	baseURL string
	secret  string
	http    *http.Client
}

func NewClient(baseURL, secret string) *Client {
	return &Client{
		baseURL: baseURL,
		secret:  secret,
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

type PushRequest struct {
	UserID    uuid.UUID `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	ActionURL *string   `json:"action_url,omitempty"`
}

// Push creates a notification and delivers it live if the user has an open
// WebSocket connection. Callers should treat a failure here as non-fatal to
// their own job — notify-svc being unreachable shouldn't fail an upload or a
// transcode.
func (c *Client) Push(ctx context.Context, req PushRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshaling push request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/notify", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("building push request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-Secret", c.secret)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return fmt.Errorf("calling notify-svc: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("notify-svc returned %d", resp.StatusCode)
	}
	return nil
}
