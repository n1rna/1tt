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

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg))
			r.Post("/files", handler.UploadFile(cfg, db))
			r.Get("/files", handler.ListFiles(db))
			r.Get("/files/{id}", handler.GetFile(cfg, db))
			r.Delete("/files/{id}", handler.DeleteFile(cfg, db))
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
