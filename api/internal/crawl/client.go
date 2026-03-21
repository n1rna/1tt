package crawl

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

const crawlBaseURL = "https://api.cloudflare.com/client/v4/accounts"

// Client is a thin HTTP client for the Cloudflare Browser Rendering Crawl API.
type Client struct {
	accountID  string
	apiToken   string
	httpClient *http.Client
}

// CrawlRequest holds the parameters for starting a crawl job.
type CrawlRequest struct {
	URL   string
	Limit int
	Depth int
	Render bool
}

// CrawlStatus holds the current state of a running crawl job.
type CrawlStatus struct {
	ID       string
	Status   string
	Total    int
	Finished int
}

// CrawlPage holds the content of a single crawled page.
type CrawlPage struct {
	URL        string
	Markdown   string
	Title      string
	StatusCode int
}

// CrawlResults holds both successfully crawled pages and error details.
type CrawlResults struct {
	Pages       []CrawlPage
	TotalRecords int
	ErroredCount int
	// FirstError contains details of the first errored page (for error reporting).
	FirstErrorURL    string
	FirstErrorStatus int
	FirstErrorBody   string // truncated markdown from the error page
}

// NewClient creates a new Cloudflare crawl client.
func NewClient(accountID, apiToken string) *Client {
	return &Client{
		accountID: accountID,
		apiToken:  apiToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// StartCrawl submits a new crawl job and returns the Cloudflare job ID.
func (c *Client) StartCrawl(ctx context.Context, req CrawlRequest) (string, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 500
	}

	body := map[string]any{
		"url":     req.URL,
		"limit":   limit,
		"depth":   req.Depth,
		"formats": []string{"markdown"},
		"render":  req.Render,
		"source":  "all",
	}

	data, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("crawl: marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/%s/browser-rendering/crawl", crawlBaseURL, c.accountID)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("crawl: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("crawl: start crawl request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("crawl: read start response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("crawl: start crawl HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var result struct {
		Success bool   `json:"success"`
		Result  string `json:"result"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("crawl: decode start response: %w", err)
	}
	if !result.Success {
		return "", fmt.Errorf("crawl: start crawl API returned success=false")
	}

	return result.Result, nil
}

// GetStatus returns the current status of a crawl job.
func (c *Client) GetStatus(ctx context.Context, jobID string) (*CrawlStatus, error) {
	url := fmt.Sprintf("%s/%s/browser-rendering/crawl/%s?limit=1", crawlBaseURL, c.accountID, jobID)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("crawl: build status request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("crawl: get status request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("crawl: read status response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("crawl: get status HTTP %d: %s", resp.StatusCode, string(raw))
	}

	var envelope struct {
		Result struct {
			ID       string `json:"id"`
			Status   string `json:"status"`
			Total    int    `json:"total"`
			Finished int    `json:"finished"`
		} `json:"result"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("crawl: decode status response: %w", err)
	}

	return &CrawlStatus{
		ID:       envelope.Result.ID,
		Status:   envelope.Result.Status,
		Total:    envelope.Result.Total,
		Finished: envelope.Result.Finished,
	}, nil
}

// GetResults paginates through all completed crawl results and returns them.
func (c *Client) GetResults(ctx context.Context, jobID string) (*CrawlResults, error) {
	result := &CrawlResults{}
	var cursor int

	for {
		url := fmt.Sprintf("%s/%s/browser-rendering/crawl/%s?limit=100&cursor=%d",
			crawlBaseURL, c.accountID, jobID, cursor)

		httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("crawl: build results request: %w", err)
		}
		httpReq.Header.Set("Authorization", "Bearer "+c.apiToken)

		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("crawl: get results request: %w", err)
		}

		raw, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("crawl: read results response: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("crawl: get results HTTP %d: %s", resp.StatusCode, string(raw))
		}

		var envelope struct {
			Result struct {
				Records []struct {
					URL      string `json:"url"`
					Status   string `json:"status"`
					Markdown string `json:"markdown"`
					Metadata struct {
						Title  string `json:"title"`
						Status int    `json:"status"`
					} `json:"metadata"`
				} `json:"records"`
				Cursor int `json:"cursor"`
			} `json:"result"`
		}
		if err := json.Unmarshal(raw, &envelope); err != nil {
			return nil, fmt.Errorf("crawl: decode results response: %w", err)
		}

		for _, r := range envelope.Result.Records {
			result.TotalRecords++
			if r.Status != "completed" {
				result.ErroredCount++
				// Capture first error details for reporting
				if result.FirstErrorURL == "" {
					result.FirstErrorURL = r.URL
					result.FirstErrorStatus = r.Metadata.Status
					body := r.Markdown
					if len(body) > 200 {
						body = body[:200]
					}
					result.FirstErrorBody = body
				}
				continue
			}
			result.Pages = append(result.Pages, CrawlPage{
				URL:        r.URL,
				Markdown:   r.Markdown,
				Title:      r.Metadata.Title,
				StatusCode: r.Metadata.Status,
			})
		}

		// cursor == 0 means no more pages
		if envelope.Result.Cursor == 0 || len(envelope.Result.Records) == 0 {
			break
		}
		cursor = envelope.Result.Cursor
	}

	return result, nil
}

// NormalizeURL strips scheme, www prefix, and trailing slash, and lowercases the host.
func NormalizeURL(rawURL string) string {
	// Remove scheme
	s := rawURL
	if idx := strings.Index(s, "://"); idx != -1 {
		s = s[idx+3:]
	}

	// Strip www.
	s = strings.TrimPrefix(s, "www.")

	// Lowercase host (everything before first /)
	if slashIdx := strings.Index(s, "/"); slashIdx != -1 {
		s = strings.ToLower(s[:slashIdx]) + s[slashIdx:]
	} else {
		s = strings.ToLower(s)
	}

	// Strip trailing slash
	s = strings.TrimRight(s, "/")

	return s
}
