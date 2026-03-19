// Package ws provides a thin WebSocket client used by the tunnel command.
package ws

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

// Message is the wire format exchanged between the CLI and the 1tt.dev server.
type Message struct {
	// ID is echoed back so the server can correlate responses to requests.
	ID string `json:"id,omitempty"`
	// Type identifies the message kind: "ready", "query", "schema",
	// "ping", "pong", "result", "error".
	Type string `json:"type"`
	// Dialect is set on the initial "ready" message ("postgres" or "redis").
	Dialect string `json:"dialect,omitempty"`
	// Payload carries arbitrary JSON for the specific message type.
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Client wraps a gorilla/websocket connection with convenience methods.
type Client struct {
	conn *websocket.Conn
}

// Connect dials the given WebSocket URL and returns a ready-to-use Client.
// The caller owns the returned Client and must call Close() when done.
func Connect(url string) (*Client, error) {
	dialer := websocket.Dialer{
		// Inherit proxy settings from the environment.
		Proxy: http.ProxyFromEnvironment,
	}

	conn, resp, err := dialer.Dial(url, nil)
	if err != nil {
		if resp != nil {
			return nil, fmt.Errorf("websocket dial %s: HTTP %d: %w", url, resp.StatusCode, err)
		}
		return nil, fmt.Errorf("websocket dial %s: %w", url, err)
	}

	return &Client{conn: conn}, nil
}

// Send JSON-encodes msg and writes it as a single text frame.
func (c *Client) Send(msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}
	if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return fmt.Errorf("write message: %w", err)
	}
	return nil
}

// ReadMessage blocks until the next text frame arrives and deserializes it.
func (c *Client) ReadMessage() (Message, error) {
	_, data, err := c.conn.ReadMessage()
	if err != nil {
		return Message{}, fmt.Errorf("read message: %w", err)
	}
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return Message{}, fmt.Errorf("unmarshal message: %w", err)
	}
	return msg, nil
}

// Close sends a WebSocket close frame and releases the underlying connection.
func (c *Client) Close() {
	_ = c.conn.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
	)
	_ = c.conn.Close()
}
