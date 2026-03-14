package billing

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/n1rna/1two/api/internal/config"
)

// Client wraps the Polar HTTP API.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
	cfg        *config.Config
}

// NewClient creates a new Polar API client.
func NewClient(cfg *config.Config) *Client {
	base := "https://api.polar.sh"
	if cfg.PolarEnvironment == "sandbox" {
		base = "https://sandbox-api.polar.sh"
	}
	return &Client{
		baseURL:    base,
		token:      cfg.PolarAccessToken,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		cfg:        cfg,
	}
}

// Config returns the billing configuration.
func (c *Client) Config() *config.Config { return c.cfg }

func (c *Client) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("billing: marshal: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	return c.httpClient.Do(req)
}

// EnsureCustomer creates or retrieves a Polar customer mapped to the given user.
// It upserts into billing_customers and returns the Polar customer ID.
func (c *Client) EnsureCustomer(ctx context.Context, db *sql.DB, userID, email, name string) (string, error) {
	// Check cache first
	existing, err := GetPolarCustomerID(ctx, db, userID)
	if err != nil {
		return "", err
	}
	if existing != "" {
		log.Printf("billing: EnsureCustomer cache hit: userId=%s polarCustomerId=%s", userID, existing)
		return existing, nil
	}

	// Try to get by external ID first
	resp, err := c.do(ctx, "GET", fmt.Sprintf("/v1/customers/external/%s", userID), nil)
	if err != nil {
		return "", fmt.Errorf("billing: get customer: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		var cust struct{ ID string `json:"id"` }
		if err := json.NewDecoder(resp.Body).Decode(&cust); err == nil && cust.ID != "" {
			// Cache it
			db.ExecContext(ctx,
				`INSERT INTO billing_customers (user_id, polar_customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				userID, cust.ID)
			return cust.ID, nil
		}
	}

	// Create new customer
	payload := map[string]any{
		"email":                email,
		"name":                 name,
		"external_customer_id": userID,
	}
	resp2, err := c.do(ctx, "POST", "/v1/customers/", payload)
	if err != nil {
		return "", fmt.Errorf("billing: create customer: %w", err)
	}
	defer resp2.Body.Close()

	// If 422 (email already exists), look up by email and update external ID
	if resp2.StatusCode == 422 {
		customerID, lookupErr := c.lookupAndLinkByEmail(ctx, db, userID, email)
		if lookupErr != nil {
			return "", fmt.Errorf("billing: create customer: email exists, lookup failed: %w", lookupErr)
		}
		return customerID, nil
	}

	if resp2.StatusCode != 201 && resp2.StatusCode != 200 {
		body, _ := io.ReadAll(resp2.Body)
		return "", fmt.Errorf("billing: create customer: HTTP %d: %s", resp2.StatusCode, string(body))
	}

	var created struct{ ID string `json:"id"` }
	if err := json.NewDecoder(resp2.Body).Decode(&created); err != nil {
		return "", fmt.Errorf("billing: decode customer: %w", err)
	}

	// Cache
	db.ExecContext(ctx,
		`INSERT INTO billing_customers (user_id, polar_customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, created.ID)

	return created.ID, nil
}

// lookupAndLinkByEmail finds an existing Polar customer by email and links them to the user.
func (c *Client) lookupAndLinkByEmail(ctx context.Context, db *sql.DB, userID, email string) (string, error) {
	resp, err := c.do(ctx, "GET", fmt.Sprintf("/v1/customers/?email=%s&limit=1", email), nil)
	if err != nil {
		return "", fmt.Errorf("lookup by email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("lookup by email: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("lookup by email: decode: %w", err)
	}
	if len(result.Items) == 0 {
		return "", fmt.Errorf("lookup by email: no customer found for %s", email)
	}

	customerID := result.Items[0].ID

	// Update the external customer ID to link to our user
	updatePayload := map[string]any{"external_customer_id": userID}
	resp2, err := c.do(ctx, "PATCH", fmt.Sprintf("/v1/customers/%s", customerID), updatePayload)
	if err != nil {
		log.Printf("billing: failed to update external ID for customer %s: %v", customerID, err)
	} else {
		resp2.Body.Close()
	}

	// Cache
	db.ExecContext(ctx,
		`INSERT INTO billing_customers (user_id, polar_customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, customerID)

	log.Printf("billing: linked existing customer %s (email=%s) to user %s", customerID, email, userID)
	return customerID, nil
}

// IngestEvent sends a usage event to Polar's event ingestion endpoint.
// See: POST /v1/customer-meters/events
func (c *Client) IngestEvent(ctx context.Context, externalCustomerID, eventName string, metadata map[string]string) error {
	payload := map[string]any{
		"events": []map[string]any{
			{
				"customer_external_id": externalCustomerID,
				"name":                 eventName,
				"metadata":             metadata,
			},
		},
	}
	resp, err := c.do(ctx, "POST", "/v1/customer-meters/events", payload)
	if err != nil {
		return fmt.Errorf("billing: ingest event: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("billing: ingest event %s: HTTP %d: %s", eventName, resp.StatusCode, string(body))
		return fmt.Errorf("billing: ingest event: HTTP %d", resp.StatusCode)
	}
	return nil
}

// CreateCheckoutSession creates a Polar checkout session and returns the checkout URL.
// customerID is the Polar customer ID (not the external/user ID).
func (c *Client) CreateCheckoutSession(ctx context.Context, productID, customerID, successURL string) (string, error) {
	payload := map[string]any{
		"products":    []string{productID},
		"success_url": successURL,
		"customer_id": customerID,
	}
	resp, err := c.do(ctx, "POST", "/v1/checkouts/", payload)
	if err != nil {
		return "", fmt.Errorf("billing: create checkout: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 && resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("billing: create checkout: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct{ URL string `json:"url"` }
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("billing: decode checkout: %w", err)
	}
	return result.URL, nil
}

// CreateCustomerSession creates a Polar customer portal session and returns the session token.
func (c *Client) CreateCustomerSession(ctx context.Context, customerID string) (string, error) {
	payload := map[string]any{
		"customer_id": customerID,
	}
	resp, err := c.do(ctx, "POST", "/v1/customer-sessions/", payload)
	if err != nil {
		return "", fmt.Errorf("billing: create portal: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 && resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("billing: create portal: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct{ Token string `json:"token"` }
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("billing: decode portal: %w", err)
	}
	return result.Token, nil
}

// CancelSubscription cancels a subscription at the end of the current period.
func (c *Client) CancelSubscription(ctx context.Context, subscriptionID string) error {
	resp, err := c.do(ctx, "DELETE", fmt.Sprintf("/v1/subscriptions/%s", subscriptionID), nil)
	if err != nil {
		return fmt.Errorf("billing: cancel subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("billing: cancel subscription: HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
