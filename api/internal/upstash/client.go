package upstash

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const managementBaseURL = "https://api.upstash.com"

// Client wraps the Upstash Management API.
type Client struct {
	email      string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Upstash Management API client.
func NewClient(email, apiKey string) *Client {
	return &Client{
		email:      email,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Database represents an Upstash Redis database resource.
type Database struct {
	DatabaseID        string `json:"database_id"`
	DatabaseName      string `json:"database_name"`
	Endpoint          string `json:"endpoint"`
	Port              int    `json:"port"`
	Password          string `json:"password"`
	RestToken         string `json:"rest_token"`
	ReadOnlyRestToken string `json:"read_only_rest_token"`
	State             string `json:"state"`
	Region            string `json:"primary_region"`
	CreationTime      int64  `json:"creation_time"`
}

// do performs an authenticated request to the Upstash Management API using
// HTTP Basic Auth (email:apiKey).
func (c *Client) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("upstash: marshal: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, managementBaseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.email, c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	return c.httpClient.Do(req)
}

// CreateDatabase provisions a new Upstash Redis database.
// POST /v2/redis/database
func (c *Client) CreateDatabase(ctx context.Context, name, region string) (*Database, error) {
	payload := map[string]any{
		"database_name":  "1tt-" + name,
		"platform":       "aws",
		"primary_region": region,
		"tls":            true,
	}
	resp, err := c.do(ctx, "POST", "/v2/redis/database", payload)
	if err != nil {
		return nil, fmt.Errorf("upstash: create database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upstash: create database: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result Database
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("upstash: create database: decode: %w", err)
	}
	return &result, nil
}

// GetDatabase retrieves an Upstash Redis database by its ID.
// GET /v2/redis/database/{id}
func (c *Client) GetDatabase(ctx context.Context, id string) (*Database, error) {
	resp, err := c.do(ctx, "GET", "/v2/redis/database/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("upstash: get database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("upstash: get database: not found")
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upstash: get database: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result Database
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("upstash: get database: decode: %w", err)
	}
	return &result, nil
}

// DeleteDatabase deletes an Upstash Redis database by its ID.
// DELETE /v2/redis/database/{id}
func (c *Client) DeleteDatabase(ctx context.Context, id string) error {
	resp, err := c.do(ctx, "DELETE", "/v2/redis/database/"+id, nil)
	if err != nil {
		return fmt.Errorf("upstash: delete database: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upstash: delete database: HTTP %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
