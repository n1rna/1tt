# 1two.dev Development Commands
# Run with: just <command>

# Default recipe to display help
default:
    @just --list

# =========================================
# Helper Recipes
# =========================================

# Run command with all env vars loaded (web + api)
with-env *args:
    ee apply .env.web.development -- ee apply .env.api.development -- {{args}}

# Run command with web env vars loaded
with-env-web *args:
    ee apply .env.web.development -- {{args}}

# Run command with api env vars loaded
with-env-api *args:
    ee apply .env.api.development -- {{args}}

# Verify all ee project schemas
ee-verify:
    @echo "=== Verifying web ===" && cp .ee.web .ee && ee verify --env development; rm -f .ee
    @echo "=== Verifying api ===" && cp .ee.api .ee && ee verify --env development; rm -f .ee

# =========================================
# Setup and Installation
# =========================================

# Install all dependencies
install:
    bun install --frozen-lockfile
    cd api && go mod download

# =========================================
# Development
# =========================================

# Start Next.js dev server
dev:
    just with-env-web bun run dev

# Start Go API server
api:
    just with-env-api bash -c '"cd api && go run ./cmd/server"'

# Start both web and api in parallel
dev-all:
    just api &
    just dev

# =========================================
# Code Generation
# =========================================

# Generate API client hooks from OpenAPI spec
api-generate:
    bunx kubb generate

# =========================================
# Build
# =========================================

# Build Next.js for production
build:
    just with-env-web bun run build

# Build Go API binary
api-build:
    cd api && CGO_ENABLED=0 go build -o server ./cmd/server

# Build Go API Docker image
api-docker-build:
    cd api && docker build -t 1two-api .

# =========================================
# Testing
# =========================================

# Run unit tests
test:
    just with-env-web bun run test

# Run e2e tests
test-e2e:
    just with-env-web bun run test:e2e

# Run Go tests
api-test:
    just with-env-api bash -c '"cd api && go test ./..."'

# =========================================
# Linting & Formatting
# =========================================

# Lint frontend
lint:
    bun run lint

# Type-check frontend
typecheck:
    bunx --bun tsc --noEmit

# Format Go code
api-fmt:
    cd api && go fmt ./...

# Lint Go code
api-lint:
    cd api && go vet ./...

# =========================================
# Database
# =========================================

# Run better-auth migrations (creates tables)
db-migrate:
    just with-env-web bunx @better-auth/cli migrate

# Run goose migrations against the API database (applies all pending Up migrations)
db-migrate-api:
    just with-env-api bash -c '"cd api && goose -dir internal/database/migrations postgres \"$DATABASE_URL\" up"'

# Create a new goose migration file — usage: just db-create-migration <name>
db-create-migration name:
    cd api && goose -dir internal/database/migrations create {{name}} sql

# =========================================
# Deployment (Cloudflare)
# =========================================

# Build Next.js for Cloudflare Workers
cf-build:
    bun run cf:build

# Preview Next.js on local Cloudflare dev
cf-preview:
    bun run cf:preview

# Deploy Next.js to Cloudflare Workers
cf-deploy:
    bun run cf:deploy

# Deploy Go API container to Cloudflare
cf-deploy-api:
    cd workers/api-container && bun install && wrangler deploy

# Deploy everything (web + api)
deploy: cf-deploy cf-deploy-api

# Set a secret for the web worker
cf-secret-web name:
    wrangler secret put {{name}}

# Set a secret for the api container worker
cf-secret-api name:
    cd workers/api-container && wrangler secret put {{name}}

# =========================================
# Utilities
# =========================================

# Clean build artifacts
clean:
    rm -rf .next out node_modules
    cd api && rm -f server

# Show project status
status:
    @echo "=== Git Status ==="
    @git status --short
    @echo ""
    @echo "=== Dependencies ==="
    @if [ -d node_modules ]; then echo "✅ Node dependencies installed"; else echo "❌ Node dependencies missing"; fi
    @echo ""
    @echo "=== Go Modules ==="
    @cd api && if go build ./... > /dev/null 2>&1; then echo "✅ Go modules OK"; else echo "❌ Go build issues"; fi
    @echo ""
    @echo "=== Environment ==="
    @ee apply development -c .ee.web --dry-run 2>/dev/null | grep -c export | xargs -I{} echo "✅ {} web env vars configured"
    @ee apply development -c .ee.api --dry-run 2>/dev/null | grep -c export | xargs -I{} echo "✅ {} api env vars configured"
