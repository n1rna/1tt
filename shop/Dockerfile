FROM oven/bun:1 AS deps

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=postgres://localhost/dummy
RUN npx medusa build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/medusa-config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src

EXPOSE 9000

# Run migrations on every start (idempotent — no-op if already up to date), then start server
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
