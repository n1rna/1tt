package executor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ElasticsearchExecutor wraps an HTTP client that proxies requests to a local
// Elasticsearch cluster.
type ElasticsearchExecutor struct {
	baseURL string
	client  *http.Client
}

// NewElasticsearch creates and validates a new ElasticsearchExecutor.
// connStr must be an http:// or https:// URL. Connectivity is confirmed by
// issuing GET / against the cluster.
func NewElasticsearch(connStr string) (*ElasticsearchExecutor, error) {
	connStr = strings.TrimRight(connStr, "/")
	if !strings.HasPrefix(connStr, "http://") && !strings.HasPrefix(connStr, "https://") {
		return nil, fmt.Errorf("invalid elasticsearch URL: must start with http:// or https://")
	}

	e := &ElasticsearchExecutor{
		baseURL: connStr,
		client:  &http.Client{Timeout: 10 * time.Second},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := e.GetVersion(ctx); err != nil {
		return nil, fmt.Errorf("could not reach elasticsearch: %w", err)
	}

	return e, nil
}

// Execute makes an HTTP request to baseURL+path with the given method and
// optional body. It returns the parsed JSON response as any.
func (e *ElasticsearchExecutor) Execute(ctx context.Context, method, path, body string) (any, error) {
	url := e.baseURL + path

	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewBufferString(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("elasticsearch returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result any
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parsing response JSON: %w", err)
	}

	return result, nil
}

// GetVersion hits GET / and extracts .version.number from the response.
func (e *ElasticsearchExecutor) GetVersion(ctx context.Context) (string, error) {
	raw, err := e.Execute(ctx, http.MethodGet, "/", "")
	if err != nil {
		return "", err
	}

	obj, ok := raw.(map[string]any)
	if !ok {
		return "unknown", nil
	}

	versionObj, ok := obj["version"].(map[string]any)
	if !ok {
		return "unknown", nil
	}

	number, ok := versionObj["number"].(string)
	if !ok {
		return "unknown", nil
	}

	return number, nil
}

// catIndex is the shape returned by GET /_cat/indices?format=json.
type catIndex struct {
	Index     string `json:"index"`
	Health    string `json:"health"`
	Status    string `json:"status"`
	DocsCount string `json:"docs.count"`
	StoreSize string `json:"store.size"`
}

// GetSchema hits GET /_cat/indices and returns each index as a SchemaTable.
// The table Name is the index name, Schema holds the health status
// (green/yellow/red), and Columns carry status, docs_count, and store_size.
func (e *ElasticsearchExecutor) GetSchema(ctx context.Context) ([]SchemaTable, error) {
	const endpoint = "/_cat/indices?format=json&h=index,health,status,docs.count,store.size"

	raw, err := e.Execute(ctx, http.MethodGet, endpoint, "")
	if err != nil {
		return nil, fmt.Errorf("fetching indices: %w", err)
	}

	// Re-marshal and decode into the typed slice so we get clean field access.
	encoded, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("re-encoding indices response: %w", err)
	}

	var indices []catIndex
	if err := json.Unmarshal(encoded, &indices); err != nil {
		return nil, fmt.Errorf("parsing indices: %w", err)
	}

	tables := make([]SchemaTable, 0, len(indices))
	for _, idx := range indices {
		tables = append(tables, SchemaTable{
			Name:   idx.Index,
			Schema: idx.Health,
			Columns: []SchemaColumn{
				{Name: "status", DataType: idx.Status, IsNullable: false},
				{Name: "docs_count", DataType: idx.DocsCount, IsNullable: false},
				{Name: "store_size", DataType: idx.StoreSize, IsNullable: false},
			},
		})
	}

	return tables, nil
}

// Close is a no-op — the HTTP client is stateless and requires no teardown.
func (e *ElasticsearchExecutor) Close() {}
