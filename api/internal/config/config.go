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

	// R2 storage
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string

	// Internal auth for cron jobs
	InternalSecret string

	// Cloudflare Browser Rendering
	CfAccountID string
	CfAPIToken  string

	// LLM provider for llms.txt generation
	LLMProvider string // "openai" (default, OpenAI-compatible) or "anthropic"
	LLMAPIKey   string
	LLMBaseURL  string // base URL for OpenAI-compatible providers (e.g. Kimi K2)
	LLMModel    string // model ID (e.g. "kimi-k2-0711", "claude-sonnet-4-20250514")

	// Polar billing
	PolarAccessToken      string
	PolarWebhookSecret    string
	PolarOrganizationID   string
	PolarEnvironment      string // "sandbox" or "production"
	PolarProProductID string
	PolarMaxProductID string

	// Neon serverless database provisioning
	NeonAPIKey string
	NeonOrgID  string

	// Turso hosted SQLite
	TursoAPIToken string // TURSO_API_TOKEN
	TursoOrgSlug  string // TURSO_ORG_SLUG
	TursoGroup    string // TURSO_GROUP (default: "default")

	// Upstash Redis
	UpstashEmail  string // UPSTASH_EMAIL
	UpstashAPIKey string // UPSTASH_API_KEY
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
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

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2BucketName:      os.Getenv("R2_BUCKET_NAME"),

		InternalSecret: os.Getenv("INTERNAL_SECRET"),

		CfAccountID: os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		CfAPIToken:  os.Getenv("CLOUDFLARE_API_TOKEN"),

		LLMProvider: getEnvOrDefault("LLM_PROVIDER", "openai"),
		LLMAPIKey:   os.Getenv("LLM_API_KEY"),
		LLMBaseURL:  getEnvOrDefault("LLM_BASE_URL", "https://api.moonshot.ai/v1"),
		LLMModel:    getEnvOrDefault("LLM_MODEL", "kimi-k2-0711-preview"),

		PolarAccessToken:       os.Getenv("POLAR_ACCESS_TOKEN"),
		PolarWebhookSecret:     os.Getenv("POLAR_WEBHOOK_SECRET"),
		PolarOrganizationID:    os.Getenv("POLAR_ORGANIZATION_ID"),
		PolarEnvironment:       getEnvOrDefault("POLAR_ENVIRONMENT", "sandbox"),
		PolarProProductID: os.Getenv("POLAR_PRO_PRODUCT_ID"),
		PolarMaxProductID: os.Getenv("POLAR_MAX_PRODUCT_ID"),

		NeonAPIKey: os.Getenv("NEON_API_KEY"),
		NeonOrgID:  os.Getenv("NEON_ORG_ID"),

		TursoAPIToken: os.Getenv("TURSO_API_TOKEN"),
		TursoOrgSlug:  os.Getenv("TURSO_ORG_SLUG"),
		TursoGroup:    getEnvOrDefault("TURSO_GROUP", "default"),

		UpstashEmail:  os.Getenv("UPSTASH_EMAIL"),
		UpstashAPIKey: os.Getenv("UPSTASH_API_KEY"),
	}
}
