package config

import (
	"os"
	"strings"
)

type Config struct {
	DatabaseURL        string
	AllowedOrigins     []string
	UploadDir          string
	TurnstileSecretKey string
}

func Load() *Config {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000"
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	return &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		AllowedOrigins:     strings.Split(origins, ","),
		UploadDir:          uploadDir,
		TurnstileSecretKey: os.Getenv("TURNSTILE_SECRET_KEY"),
	}
}
