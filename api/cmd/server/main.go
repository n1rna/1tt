package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/billing"
	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/crawl"
	"github.com/n1rna/1tt/api/internal/database"
	"github.com/n1rna/1tt/api/internal/handler"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/llms"
	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/neon"
	"github.com/n1rna/1tt/api/internal/poker"
	"github.com/n1rna/1tt/api/internal/storage"
	"github.com/n1rna/1tt/api/internal/tunnel"
	"github.com/n1rna/1tt/api/internal/turso"
	"github.com/n1rna/1tt/api/internal/upstash"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Printf("WARNING: failed to open database: %v (file routes will be unavailable)", err)
	}
	if db != nil {
		defer db.Close()
	}

	var r2 *storage.R2Client
	if cfg.R2AccountID != "" {
		r2, err = storage.NewR2Client(cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2BucketName)
		if err != nil {
			log.Printf("WARNING: failed to init R2 client: %v (file routes will be unavailable)", err)
		}
	} else {
		log.Printf("WARNING: R2 not configured (file upload/download will be unavailable)")
	}

	// Cloudflare client for R2 bucket and token management.
	var cfStorageClient *storage.CloudflareClient
	if cfg.CfAccountID != "" && cfg.CfAPIToken != "" {
		cfStorageClient = storage.NewCloudflareClient(cfg.CfAccountID, cfg.CfAPIToken)
		log.Printf("INFO: Cloudflare storage client initialised (account: %s)", cfg.CfAccountID)
	} else {
		log.Printf("WARNING: Cloudflare client not configured (missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN — storage bucket provisioning will be unavailable)")
	}

	var llmsSvc *llms.Service
	if cfg.CfAccountID != "" && cfg.LLMAPIKey != "" && db != nil && r2 != nil {
		crawlClient := crawl.NewClient(cfg.CfAccountID, cfg.CfAPIToken)
		llmsSvc = llms.NewService(db, r2, crawlClient, ai.LLMConfig{
			Provider: cfg.LLMProvider,
			APIKey:   cfg.LLMAPIKey,
			BaseURL:  cfg.LLMBaseURL,
			Model:    cfg.LLMModel,
		})
	} else {
		log.Printf("WARNING: llms.txt generator not configured (missing CLOUDFLARE_ACCOUNT_ID, LLM_API_KEY, DB, or R2)")
	}

	// Google Calendar OAuth client (optional).
	var gcalClient *life.GCalClient
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		gcalClient = life.NewGCalClient(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
		log.Printf("INFO: Google Calendar client initialised (redirect URI: %s)", cfg.GoogleRedirectURI)
	} else {
		log.Printf("WARNING: Google Calendar not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)")
	}

	// Life tool — AI-powered life planning agent.
	lifeAgent := life.NewAgent(ai.LLMConfig{
		Provider: cfg.LLMProvider,
		APIKey:   cfg.LLMAPIKey,
		BaseURL:  cfg.LLMBaseURL,
		Model:    cfg.LLMModel,
	}, db, gcalClient)

	var billingClient *billing.Client
	if cfg.PolarAccessToken != "" && db != nil {
		billingClient = billing.NewClient(cfg)
	} else {
		log.Printf("WARNING: Polar billing not configured (missing POLAR_ACCESS_TOKEN or DB)")
	}

	var emailSender *life.EmailSender
	if cfg.ResendAPIKey != "" {
		emailSender = life.NewEmailSender(cfg.ResendAPIKey, cfg.ResendFromEmail, cfg.EmailWorkerURL, cfg.EmailWebhookSecret)
		log.Printf("INFO: Email sender initialised (Resend, from: %s)", cfg.ResendFromEmail)
	}

	var neonClient *neon.Client
	if cfg.NeonAPIKey != "" {
		neonClient = neon.NewClient(cfg)
	} else {
		log.Printf("WARNING: Neon not configured (missing NEON_API_KEY — database provisioning will be unavailable)")
	}

	// Turso hosted SQLite — requires TURSO_API_TOKEN and TURSO_ORG_SLUG.
	var tursoClient *turso.Client
	if cfg.TursoAPIToken != "" {
		tursoClient = turso.NewClient(cfg)
		log.Printf("INFO: Turso client initialised (org: %s, group: %s)", cfg.TursoOrgSlug, cfg.TursoGroup)
	} else {
		log.Printf("WARNING: Turso not configured (missing TURSO_API_TOKEN — SQLite hosting will be unavailable)")
	}

	// Upstash Redis — requires UPSTASH_EMAIL and UPSTASH_API_KEY.
	var upstashClient *upstash.Client
	if cfg.UpstashEmail != "" && cfg.UpstashAPIKey != "" {
		upstashClient = upstash.NewClient(cfg.UpstashEmail, cfg.UpstashAPIKey)
		log.Printf("INFO: Upstash client initialised (email: %s)", cfg.UpstashEmail)
	} else {
		log.Printf("WARNING: Upstash not configured (missing UPSTASH_EMAIL or UPSTASH_API_KEY — Redis hosting will be unavailable)")
	}

	pokerHub := poker.NewHub(db)
	defer pokerHub.Shutdown()

	tunnelHub := tunnel.NewHub()
	defer tunnelHub.Shutdown()

	r := chi.NewRouter()

	// Middleware stack
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Session-Token", "X-User-ID"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", handler.Health)
		r.Get("/badge/*", handler.Badge())
		r.Get("/ip", handler.IPAddress)
		r.Get("/ip/all", handler.IPAll)
		r.Get("/ip/info", handler.IPInfo)
		r.Post("/dns/lookup", handler.DNSLookup(cfg))
		r.Post("/og-check", handler.OgCheck(cfg))
		r.Post("/ssl-check", handler.SslCheck(cfg))
		r.Post("/email-check", handler.EmailCheck(cfg))

		// Polar webhook (public, uses signature verification)
		if billingClient != nil {
			r.Post("/webhooks/polar", handler.PolarWebhook(cfg, db, billingClient))
		}

		// Life channel webhooks (public, use their own authentication)
		if db != nil {
			r.Post("/life/webhooks/telegram", handler.TelegramWebhook(cfg, db, lifeAgent))
			r.Post("/life/webhooks/email", handler.EmailWebhook(cfg, db, lifeAgent))
		}

		// Internal routes (protected by secret)
		if r2 != nil && db != nil {
			r.Post("/internal/cleanup", handler.CleanupExpiredFiles(cfg, db, r2))
		}

		// Hosted SQLite — API key auth (no session required)
		if db != nil {
			r.Post("/sqlite/{id}/query", handler.QuerySqliteDB(db, tursoClient))
			r.Get("/sqlite/{id}/schema", handler.GetSqliteSchema(db, tursoClient))
		}

		// Planning Poker (public — no auth required)
		r.Get("/poker/ws", poker.HandleWebSocket(pokerHub))
		r.Get("/poker/check", poker.HandleCheckSession(pokerHub))

		// Tunnel WebSocket (public — CLI authenticates via token)
		r.Get("/tunnel/{token}/ws", tunnel.HandleWebSocket(tunnelHub))

		// Public routes (no auth)
		if db != nil {
			r.Get("/pastes/{id}", handler.GetPaste(db))
			r.Get("/og/s/{slug}", handler.GetOgCollectionBySlug(db, billingClient))
		}
		if llmsSvc != nil {
			r.Get("/llms/s/{slug}", handler.GetLlmsPublicFile(llmsSvc))
		}
		if db != nil && r2 != nil {
			r.Get("/logo/s/{slug}", handler.GetLogoImageBySlug(db, r2))
		}

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg))

			// Tunnel hub
			r.Post("/tunnel/create", tunnel.HandleCreateToken(tunnelHub))
			r.Get("/tunnel/{token}/status", tunnel.HandleStatus(tunnelHub))
			r.Post("/tunnel/{token}/query", tunnel.HandleQuery(tunnelHub))
			r.Get("/tunnel/{token}/schema", tunnel.HandleSchema(tunnelHub))

			// Planning Poker
			r.Post("/poker/sessions", poker.HandleCreateSession(pokerHub))
			r.Get("/poker/sessions", poker.HandleListSessions(pokerHub))
			r.Post("/poker/sessions/{id}/disable", poker.HandleDisableSession(pokerHub))
			r.Post("/poker/sessions/{id}/enable", poker.HandleEnableSession(pokerHub))
			r.Delete("/poker/sessions/{id}", poker.HandleDeleteSession(pokerHub))
			if r2 != nil && db != nil {
				r.Post("/files", handler.UploadFile(cfg, db, r2))
				r.Get("/files", handler.ListFiles(db))
				r.Get("/files/{id}", handler.GetFile(db, r2))
				r.Delete("/files/{id}", handler.DeleteFile(db, r2))
			}
			if db != nil {
				r.Post("/pastes", handler.CreatePaste(db, billingClient))
				r.Get("/pastes", handler.ListPastes(db))
				r.Put("/pastes/{id}", handler.UpdatePaste(db))
				r.Delete("/pastes/{id}", handler.DeletePaste(db))

				r.Get("/tool-state", handler.ListToolState(db))
				r.Get("/tool-state/summary", handler.SummaryToolState(db))
				r.Put("/tool-state", handler.PutToolState(db))
				r.Delete("/tool-state", handler.DeleteToolState(db))

				r.Get("/og/collections", handler.ListOgCollections(db))
				r.Post("/og/collections", handler.CreateOgCollection(db))
				r.Get("/og/collections/{id}", handler.GetOgCollection(db))
				r.Put("/og/collections/{id}", handler.UpdateOgCollection(db))
				r.Delete("/og/collections/{id}", handler.DeleteOgCollection(db))

				r.Patch("/logo/images/{id}", handler.PatchLogoImage(db))
			}
			if r2 != nil && db != nil {
				r.Post("/logo/images", handler.CreateLogoImage(db, r2))
				r.Get("/logo/images", handler.ListLogoImages(db))
				r.Put("/logo/images/{id}", handler.UpdateLogoImage(db, r2))
				r.Delete("/logo/images/{id}", handler.DeleteLogoImage(db, r2))
			}
			if db != nil {
				r.Get("/billing/status", handler.GetBillingStatus(db, billingClient))
				r.Post("/billing/checkout", handler.CreateCheckout(db, billingClient))
				r.Post("/billing/portal-session", handler.CreateCustomerPortalSession(db, billingClient))
			}
			if db != nil {
				r.Get("/databases", handler.ListDatabases(db))
				r.Post("/databases", handler.CreateDatabase(db, neonClient, billingClient))
				r.Get("/databases/{id}", handler.GetDatabase(db, neonClient))
				r.Delete("/databases/{id}", handler.DeleteDatabase(db, neonClient))
				r.Post("/databases/{id}/query", handler.QueryDatabase(db, neonClient))
				r.Get("/databases/{id}/schema", handler.GetDatabaseSchema(db, neonClient))
			}
			// Hosted SQLite — session-authenticated management routes.
			if db != nil {
				r.Post("/sqlite", handler.UploadSqliteDB(db, tursoClient, billingClient))
				r.Get("/sqlite", handler.ListSqliteDBs(db))
				r.Get("/sqlite/{id}", handler.GetSqliteDB(db))
				r.Delete("/sqlite/{id}", handler.DeleteSqliteDB(db, tursoClient))
			}
			// Redis routes — session-authenticated management and proxy routes.
			if db != nil {
				r.Post("/redis", handler.CreateRedis(db, upstashClient, billingClient))
				r.Get("/redis", handler.ListRedis(db))
				r.Get("/redis/{id}", handler.GetRedis(db))
				r.Delete("/redis/{id}", handler.DeleteRedis(db, upstashClient))
				r.Post("/redis/{id}/command", handler.ProxyCommand(db, upstashClient))
				r.Post("/redis/{id}/pipeline", handler.ProxyPipeline(db, upstashClient))
				r.Get("/redis/{id}/info", handler.GetRedisInfo(db, upstashClient))
			}
			// Object storage — S3-compatible buckets backed by Cloudflare R2.
			if db != nil && cfStorageClient != nil {
				r.Post("/storage/buckets", handler.CreateStorageBucket(db, r2, cfStorageClient, billingClient))
				r.Get("/storage/buckets", handler.ListStorageBuckets(db))
				r.Delete("/storage/buckets/{id}", handler.DeleteStorageBucket(db, cfg.R2AccountID, cfStorageClient))
				r.Get("/storage/buckets/{id}/credentials", handler.GetStorageBucketCredentials(db, cfStorageClient))
				r.Get("/storage/buckets/{id}/objects", handler.ListStorageObjects(db))
				r.Post("/storage/buckets/{id}/objects", handler.UploadStorageObject(db, cfg.R2AccountID, billingClient))
				r.Delete("/storage/buckets/{id}/objects/{objectId}", handler.DeleteStorageObject(db, cfg.R2AccountID))
				r.Get("/storage/buckets/{id}/objects/{objectId}/url", handler.GetStorageObjectUrl(db, cfg.R2AccountID))
				r.Get("/storage/usage", handler.GetStorageUsage(db, billingClient))
			}
			// AI query generation (SQL, Elasticsearch, etc.)
			if db != nil {
				r.Post("/ai/query", handler.GenerateAiQuery(cfg, db))
				r.Post("/ai/query/suggestions", handler.GenerateAiQuerySuggestions(db))
			}
			// Life tool — AI-powered life planning.
			if db != nil {
				r.Get("/life/profile", handler.GetLifeProfile(db))
				r.Put("/life/profile", handler.UpdateLifeProfile(db))
				r.Get("/life/channels", handler.ListChannelLinks(db))
				r.Post("/life/channels", handler.InitChannelLink(db, emailSender))
				r.Post("/life/channels/{id}/verify", handler.VerifyChannelLink(db))
				r.Delete("/life/channels/{id}", handler.DeleteChannelLink(db))
				r.Get("/life/memories", handler.ListLifeMemories(db))
				r.Post("/life/memories", handler.CreateLifeMemory(db))
				r.Put("/life/memories/{id}", handler.UpdateLifeMemory(db))
				r.Delete("/life/memories/{id}", handler.DeleteLifeMemory(db))
				r.Get("/life/conversations", handler.ListLifeConversations(db))
				r.Get("/life/conversations/by-routine/{routineId}", handler.GetConversationByRoutine(db))
				r.Get("/life/conversations/{id}", handler.GetLifeConversation(db))
				r.Delete("/life/conversations/{id}", handler.DeleteLifeConversation(db))
				r.Post("/life/chat", handler.LifeChat(db, lifeAgent, gcalClient))
				r.Post("/life/chat/stream", handler.LifeChatStream(db, lifeAgent, gcalClient))
				r.Get("/life/actionables", handler.ListLifeActionables(db))
				r.Post("/life/actionables/{id}/respond", handler.RespondToActionable(db, lifeAgent))
				r.Get("/life/routines", handler.ListLifeRoutines(db))
				r.Get("/life/routines/{id}", handler.GetLifeRoutine(db))
				r.Post("/life/routines", handler.CreateLifeRoutine(db))
				r.Put("/life/routines/{id}", handler.UpdateLifeRoutine(db))
				r.Delete("/life/routines/{id}", handler.DeleteLifeRoutine(db))
				// Google Calendar integration (all routes registered; handlers check nil).
				r.Get("/life/gcal/status", handler.GetGCalStatus(db))
				r.Get("/life/gcal/auth-url", handler.GetGCalAuthURL(gcalClient))
				r.Post("/life/gcal/callback", handler.GCalCallback(db, gcalClient))
				r.Delete("/life/gcal", handler.DisconnectGCal(db))
				r.Get("/life/gcal/events", handler.ListGCalEvents(db, gcalClient))
			}
			if llmsSvc != nil && db != nil && r2 != nil {
				r.Post("/llms/generate", handler.GenerateLlms(llmsSvc))
				r.Get("/llms/jobs", handler.ListLlmsJobs(llmsSvc))
				r.Get("/llms/jobs/{id}", handler.GetLlmsJob(llmsSvc))
				r.Delete("/llms/jobs/{id}", handler.CancelLlmsJob(llmsSvc))
				r.Get("/llms/cache", handler.GetLlmsCache(llmsSvc))
				r.Get("/llms/files/{id}", handler.GetLlmsFile(db, r2))
				r.Patch("/llms/files/{id}", handler.PatchLlmsFile(llmsSvc))
			}
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown: wait for SIGINT/SIGTERM, then drain connections
	// and stop background workers.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh

		log.Println("Shutting down...")

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		srv.Shutdown(ctx)

		if llmsSvc != nil {
			llmsSvc.Stop()
		}
	}()

	// In dev mode, start Telegram polling if configured (production uses webhooks).
	if cfg.TelegramBotToken != "" && db != nil && os.Getenv("TELEGRAM_POLL") == "1" {
		// Delete any existing webhook so polling works
		go func() {
			life.PollTelegramUpdates(context.Background(), cfg.TelegramBotToken, func(update life.TelegramUpdate) {
				if update.Message == nil || update.Message.Text == "" {
					return
				}

				chatID := update.Message.Chat.ID
				text := update.Message.Text

				// Handle /start command for linking
				if len(text) > 7 && text[:7] == "/start " {
					code := text[7:]
					var linkID string
					err := db.QueryRow(
						`UPDATE life_channel_links SET channel_uid = $1, verified = TRUE, verify_code = NULL
						 WHERE verify_code = $2 AND channel = 'telegram' AND verified = FALSE AND verify_expires > NOW()
						 RETURNING id`,
						fmt.Sprintf("%d", chatID), code,
					).Scan(&linkID)
					if err == nil {
						_ = life.SendTelegramMessage(context.Background(), cfg.TelegramBotToken, chatID, "✓ Account linked! You can now chat with your life assistant here.")
					} else {
						_ = life.SendTelegramMessage(context.Background(), cfg.TelegramBotToken, chatID, "Invalid or expired code. Please try again from https://1tt.dev/tools/life")
					}
					return
				}

				// Look up user
				var userID string
				err := db.QueryRow(
					`SELECT user_id FROM life_channel_links WHERE channel = 'telegram' AND channel_uid = $1 AND verified = TRUE`,
					fmt.Sprintf("%d", chatID),
				).Scan(&userID)
				if err != nil {
					_ = life.SendTelegramMessage(context.Background(), cfg.TelegramBotToken, chatID, "Please link your account first at https://1tt.dev/tools/life")
					return
				}

				// Ingest
				resp, err := life.IngestChannelEvent(context.Background(), db, lifeAgent, life.ChannelEvent{
					UserID:     userID,
					Channel:    "telegram",
					ChannelUID: fmt.Sprintf("%d", chatID),
					Content:    text,
				})
				if err != nil {
					log.Printf("telegram poll: ingest error: %v", err)
					_ = life.SendTelegramMessage(context.Background(), cfg.TelegramBotToken, chatID, "Sorry, something went wrong. Please try again.")
					return
				}
				_ = life.SendTelegramMessage(context.Background(), cfg.TelegramBotToken, chatID, resp.Text)
			})
		}()
		log.Printf("INFO: Telegram polling enabled (TELEGRAM_POLL=1)")
	}

	log.Printf("API server listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
