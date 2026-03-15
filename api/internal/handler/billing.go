package handler

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/n1rna/1two/api/internal/billing"
	"github.com/n1rna/1two/api/internal/middleware"
)

// GetBillingStatus returns the user's current plan, usage, and limits.
// GET /api/v1/billing/status
func GetBillingStatus(db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		// Get subscription details
		var status, periodEnd string
		var cancelAtPeriodEnd bool
		err := db.QueryRowContext(r.Context(),
			`SELECT status, COALESCE(to_char(current_period_end, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), ''), cancel_at_period_end
			 FROM billing_subscriptions
			 WHERE user_id = $1 AND status IN ('active', 'trialing')
			 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&status, &periodEnd, &cancelAtPeriodEnd)
		if err != nil {
			status = "none"
		}

		// Get current usage
		pasteUsage, _ := billing.GetCurrentUsage(r.Context(), db, userID, "paste-created")
		ogViewUsage, _ := billing.GetCurrentUsage(r.Context(), db, userID, "og-image-view")
		aiTokenUsage, _ := billing.GetCurrentUsage(r.Context(), db, userID, "ai-token-used")

		// Get resource counts
		var pgCount int
		db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_databases WHERE user_id = $1 AND status NOT IN ('deleted', 'deleting')`,
			userID).Scan(&pgCount)
		var sqliteCount int
		db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_sqlite_dbs WHERE user_id = $1 AND status = 'active'`,
			userID).Scan(&sqliteCount)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"plan":              tier,
			"status":            status,
			"cancelAtPeriodEnd": cancelAtPeriodEnd,
			"periodEnd":         periodEnd,
			"usage": map[string]any{
				"paste-created": map[string]any{
					"current":        pasteUsage,
					"limit":          limits.PastesPerMonth,
					"overageEnabled": limits.OverageEnabled,
				},
				"og-image-view": map[string]any{
					"current":        ogViewUsage,
					"limit":          limits.OgViewsPerMonth,
					"overageEnabled": limits.OverageEnabled,
				},
				"ai-token-used": map[string]any{
					"current":        aiTokenUsage,
					"limit":          limits.AiTokensPerMonth,
					"overageEnabled": limits.OverageEnabled,
				},
			},
			"resources": map[string]any{
				"databases": map[string]any{
					"current": pgCount,
					"limit":   limits.DatabasesMax,
				},
				"sqliteDbs": map[string]any{
					"current": sqliteCount,
					"limit":   limits.SqliteDbsMax,
				},
			},
			"limits": map[string]any{
				"ogCollections":   limits.OgCollections,
				"databasesMax":    limits.DatabasesMax,
				"sqliteDbsMax":    limits.SqliteDbsMax,
				"sqliteMaxSizeMB": limits.SqliteMaxSizeMB,
			},
		})
	}
}

// CreateCheckout creates a Polar checkout session for upgrading.
// POST /api/v1/billing/checkout
func CreateCheckout(db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Plan       string `json:"plan"`
			SuccessURL string `json:"successUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
			return
		}
		if req.Plan == "" || req.SuccessURL == "" {
			http.Error(w, `{"error":"plan and successUrl are required"}`, http.StatusBadRequest)
			return
		}

		if billingClient == nil {
			http.Error(w, `{"error":"billing not configured"}`, http.StatusServiceUnavailable)
			return
		}

		// Resolve plan name to Polar product ID from config
		var productID string
		switch req.Plan {
		case "pro":
			productID = billingClient.Config().PolarProProductID
		case "max":
			productID = billingClient.Config().PolarMaxProductID
		default:
			http.Error(w, `{"error":"invalid plan"}`, http.StatusBadRequest)
			return
		}

		// Pre-create the Polar customer so the checkout is locked to the user's email
		var email, name string
		db.QueryRowContext(r.Context(),
			`SELECT email, name FROM "user" WHERE id = $1`, userID).Scan(&email, &name)
		if email == "" {
			http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
			return
		}
		customerID, err := billingClient.EnsureCustomer(r.Context(), db, userID, email, name)
		if err != nil {
			log.Printf("billing: ensure customer error: %v", err)
			http.Error(w, `{"error":"failed to resolve billing account"}`, http.StatusInternalServerError)
			return
		}

		log.Printf("billing: checkout request: plan=%s productId=%s userId=%s polarCustomerId=%s email=%s", req.Plan, productID, userID, customerID, email)
		checkoutURL, err := billingClient.CreateCheckoutSession(r.Context(), productID, customerID, req.SuccessURL)
		if err != nil {
			log.Printf("billing: checkout error: %v", err)
			http.Error(w, `{"error":"failed to create checkout session"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"url": checkoutURL})
	}
}

// CreateCustomerPortalSession creates a Polar customer session token.
// The token is safe to expose client-side — it only grants access to that customer's data
// via /v1/customer-portal/* endpoints on Polar's API.
// POST /api/v1/billing/portal-session
func CreateCustomerPortalSession(db *sql.DB, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if billingClient == nil {
			http.Error(w, `{"error":"billing not configured"}`, http.StatusServiceUnavailable)
			return
		}

		// Try cached customer ID first, then create/retrieve from Polar
		customerID, _ := billing.GetPolarCustomerID(r.Context(), db, userID)
		if customerID == "" {
			var email, name string
			db.QueryRowContext(r.Context(),
				`SELECT email, name FROM "user" WHERE id = $1`, userID).Scan(&email, &name)
			if email == "" {
				http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
				return
			}
			var ensureErr error
			customerID, ensureErr = billingClient.EnsureCustomer(r.Context(), db, userID, email, name)
			if ensureErr != nil {
				log.Printf("billing: ensure customer error: %v", ensureErr)
				http.Error(w, `{"error":"failed to resolve billing account"}`, http.StatusInternalServerError)
				return
			}
		}

		token, err := billingClient.CreateCustomerSession(r.Context(), customerID)
		if err != nil {
			log.Printf("billing: create customer session error: %v", err)
			http.Error(w, `{"error":"failed to create customer session"}`, http.StatusInternalServerError)
			return
		}

		// Return both the token and the Polar API base URL so the frontend knows which env to hit
		baseURL := "https://api.polar.sh"
		if billingClient.Config().PolarEnvironment == "sandbox" {
			baseURL = "https://sandbox-api.polar.sh"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token":   token,
			"baseUrl": baseURL,
		})
	}
}
