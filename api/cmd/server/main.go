package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/n1rna/1two/api/internal/config"
	"github.com/n1rna/1two/api/internal/database"
	"github.com/n1rna/1two/api/internal/handler"
	"github.com/n1rna/1two/api/internal/middleware"
	"github.com/n1rna/1two/api/internal/storage"
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
		r.Get("/ip", handler.IPAddress)
		r.Get("/ip/all", handler.IPAll)
		r.Get("/ip/info", handler.IPInfo)
		r.Post("/dns/lookup", handler.DNSLookup(cfg))

		// Internal routes (protected by secret)
		if r2 != nil && db != nil {
			r.Post("/internal/cleanup", handler.CleanupExpiredFiles(cfg, db, r2))
		}

		// Public paste route (no auth)
		if db != nil {
			r.Get("/pastes/{id}", handler.GetPaste(db))
		}

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg))
			if r2 != nil && db != nil {
				r.Post("/files", handler.UploadFile(cfg, db, r2))
				r.Get("/files", handler.ListFiles(db))
				r.Get("/files/{id}", handler.GetFile(db, r2))
				r.Delete("/files/{id}", handler.DeleteFile(db, r2))
			}
			if db != nil {
				r.Post("/pastes", handler.CreatePaste(db))
				r.Get("/pastes", handler.ListPastes(db))
				r.Put("/pastes/{id}", handler.UpdatePaste(db))
				r.Delete("/pastes/{id}", handler.DeletePaste(db))

				r.Get("/tool-state", handler.ListToolState(db))
				r.Get("/tool-state/summary", handler.SummaryToolState(db))
				r.Put("/tool-state", handler.PutToolState(db))
				r.Delete("/tool-state", handler.DeleteToolState(db))
			}
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("API server listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
