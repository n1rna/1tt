package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/n1rna/1two/api/internal/billing"
	"github.com/n1rna/1two/api/internal/config"
)

// PolarWebhook handles incoming Polar webhook events.
// Public endpoint — no auth middleware, uses webhook signature verification.
func PolarWebhook(cfg *config.Config, db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB max
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		// Verify Standard Webhooks signature
		if !verifyWebhookSignature(cfg.PolarWebhookSecret, body, r.Header) {
			log.Printf("billing webhook: signature verification failed (id=%s ts=%s sig=%s secretPrefix=%.12s...)",
				r.Header.Get("webhook-id"),
				r.Header.Get("webhook-timestamp"),
				r.Header.Get("webhook-signature"),
				cfg.PolarWebhookSecret)
			http.Error(w, "invalid signature", http.StatusForbidden)
			return
		}

		// Parse the event envelope
		var event struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(body, &event); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		// Deduplicate by webhook-id header
		webhookID := r.Header.Get("webhook-id")
		if webhookID != "" {
			var exists bool
			db.QueryRowContext(r.Context(),
				`SELECT EXISTS(SELECT 1 FROM billing_webhook_events WHERE event_id = $1)`,
				webhookID).Scan(&exists)
			if exists {
				w.WriteHeader(http.StatusOK)
				return
			}
			db.ExecContext(r.Context(),
				`INSERT INTO billing_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				webhookID, event.Type)
		}

		log.Printf("billing webhook: %s", event.Type)

		switch event.Type {
		case "subscription.created", "subscription.active", "subscription.updated":
			handleSubscriptionEvent(r.Context(), db, cfg, event.Data)
		case "subscription.canceled", "subscription.revoked":
			handleSubscriptionCanceled(r.Context(), db, cfg, event.Data, event.Type == "subscription.revoked")
		}

		w.WriteHeader(http.StatusOK)
	}
}

func verifyWebhookSignature(secret string, body []byte, headers http.Header) bool {
	if secret == "" {
		return false
	}

	msgID := headers.Get("webhook-id")
	timestamp := headers.Get("webhook-timestamp")
	signature := headers.Get("webhook-signature")

	if msgID == "" || timestamp == "" || signature == "" {
		return false
	}

	// Check timestamp freshness (5 minute tolerance)
	ts, err := parseInt64(timestamp)
	if err != nil {
		return false
	}
	diff := math.Abs(float64(time.Now().Unix() - ts))
	if diff > 300 {
		return false
	}

	// Polar SDK base64-encodes the full secret string (including prefix) and passes
	// it to the Standard Webhooks library, which then base64-decodes it.
	// Net result: HMAC key = raw UTF-8 bytes of the full secret string.
	key := []byte(secret)

	toSign := fmt.Sprintf("%s.%s.%s", msgID, timestamp, string(body))
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(toSign))
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	for _, sig := range strings.Split(signature, " ") {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) == 2 && parts[0] == "v1" {
			if hmac.Equal([]byte(expected), []byte(parts[1])) {
				return true
			}
		}
	}
	return false
}

func parseInt64(s string) (int64, error) {
	var n int64
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}

// subscriptionPayload represents the relevant fields from a Polar subscription webhook event.
type subscriptionPayload struct {
	ID                 string `json:"id"`
	CustomerID         string `json:"customer_id"`
	CustomerExternalID string `json:"customer_external_id"`
	ProductID          string `json:"product_id"`
	Status             string `json:"status"`
	CurrentPeriodStart string `json:"current_period_start"`
	CurrentPeriodEnd   string `json:"current_period_end"`
	CancelAtPeriodEnd  bool   `json:"cancel_at_period_end"`
	Customer           struct {
		ID         string `json:"id"`
		ExternalID string `json:"external_id"`
		Email      string `json:"email"`
	} `json:"customer"`
}

func handleSubscriptionEvent(ctx context.Context, db *sql.DB, cfg *config.Config, data json.RawMessage) {
	var sub subscriptionPayload
	if err := json.Unmarshal(data, &sub); err != nil {
		log.Printf("billing webhook: failed to parse subscription: %v", err)
		return
	}

	userID := sub.CustomerExternalID
	if userID == "" {
		userID = sub.Customer.ExternalID
	}
	// If external ID not in payload, look up from our cached customer mapping
	if userID == "" {
		polarCustID := sub.CustomerID
		if polarCustID == "" {
			polarCustID = sub.Customer.ID
		}
		if polarCustID != "" {
			db.QueryRowContext(ctx,
				`SELECT user_id FROM billing_customers WHERE polar_customer_id = $1`, polarCustID).Scan(&userID)
		}
	}
	// Last resort: look up user by customer email
	if userID == "" && sub.Customer.Email != "" {
		db.QueryRowContext(ctx,
			`SELECT id FROM "user" WHERE email = $1 LIMIT 1`, sub.Customer.Email).Scan(&userID)
		if userID != "" {
			log.Printf("billing webhook: resolved user %s via email %s", userID, sub.Customer.Email)
		}
	}
	if userID == "" {
		log.Printf("billing webhook: subscription %s has no external customer ID and no cached mapping (customer_id=%s)", sub.ID, sub.CustomerID)
		return
	}

	// Cache customer mapping
	customerID := sub.CustomerID
	if customerID == "" {
		customerID = sub.Customer.ID
	}
	if customerID != "" && userID != "" {
		db.ExecContext(ctx,
			`INSERT INTO billing_customers (user_id, polar_customer_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET polar_customer_id = EXCLUDED.polar_customer_id`,
			userID, customerID)
	}

	// Map product ID to plan tier
	tier := "free"
	switch sub.ProductID {
	case cfg.PolarProProductID:
		tier = "pro"
	case cfg.PolarMaxProductID:
		tier = "max"
	}

	var periodStart, periodEnd *time.Time
	if t, err := time.Parse(time.RFC3339, sub.CurrentPeriodStart); err == nil {
		periodStart = &t
	}
	if t, err := time.Parse(time.RFC3339, sub.CurrentPeriodEnd); err == nil {
		periodEnd = &t
	}

	_, err := db.ExecContext(ctx,
		`INSERT INTO billing_subscriptions (id, user_id, polar_product_id, plan_tier, status, current_period_start, current_period_end, cancel_at_period_end, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		 ON CONFLICT (id) DO UPDATE SET
		   plan_tier = EXCLUDED.plan_tier,
		   status = EXCLUDED.status,
		   current_period_start = EXCLUDED.current_period_start,
		   current_period_end = EXCLUDED.current_period_end,
		   cancel_at_period_end = EXCLUDED.cancel_at_period_end,
		   updated_at = NOW()`,
		sub.ID, userID, sub.ProductID, tier, sub.Status, periodStart, periodEnd, sub.CancelAtPeriodEnd)
	if err != nil {
		log.Printf("billing webhook: failed to upsert subscription %s: %v", sub.ID, err)
	}
}

func handleSubscriptionCanceled(ctx context.Context, db *sql.DB, _ *config.Config, data json.RawMessage, revoked bool) {
	var sub subscriptionPayload
	if err := json.Unmarshal(data, &sub); err != nil {
		log.Printf("billing webhook: failed to parse subscription: %v", err)
		return
	}

	status := "canceled"
	if revoked {
		status = "revoked"
	}

	_, err := db.ExecContext(ctx,
		`UPDATE billing_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2`,
		status, sub.ID)
	if err != nil {
		log.Printf("billing webhook: failed to update subscription %s: %v", sub.ID, err)
	}
}
