package middleware

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"
	"github.com/n1rna/1two/api/internal/config"
)

type contextKey string

const UserIDKey contextKey = "userID"
const UserEmailKey contextKey = "userEmail"
const UserNameKey contextKey = "userName"

func GetUserID(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}

func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	var db *sql.DB
	if cfg.DatabaseURL != "" {
		var err error
		db, err = sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			log.Printf("Warning: could not connect to database for auth: %v", err)
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get session token from header (forwarded by Next.js proxy)
			token := r.Header.Get("X-Session-Token")
			userID := r.Header.Get("X-User-ID")

			// If proxy already validated and forwarded user ID, trust it
			if userID != "" && token != "" {
				ctx := context.WithValue(r.Context(), UserIDKey, userID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Fallback: validate token directly against database
			if token == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if db == nil {
				http.Error(w, `{"error":"auth service unavailable"}`, http.StatusServiceUnavailable)
				return
			}

			var uid, email, name string
			var expiresAt time.Time
			err := db.QueryRowContext(r.Context(),
				`SELECT s."userId", u.email, u.name, s."expiresAt"
				 FROM "session" s JOIN "user" u ON s."userId" = u.id
				 WHERE s.token = $1`, token,
			).Scan(&uid, &email, &name, &expiresAt)

			if err != nil || time.Now().After(expiresAt) {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, uid)
			ctx = context.WithValue(ctx, UserEmailKey, email)
			ctx = context.WithValue(ctx, UserNameKey, name)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
