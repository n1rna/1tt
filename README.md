![1tt.dev](https://1tt.dev/badge/1tt.dev-Tools_that_just_work-blue.svg?style=for-the-badge) ![status](https://1tt.dev/badge/status-active-brightgreen.svg) ![license](https://1tt.dev/badge/license-MIT-green.svg) ![TypeScript](https://1tt.dev/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white) ![Next.js](https://1tt.dev/badge/Next.js-16-000.svg?logo=nextdotjs&logoColor=white) ![Go](https://1tt.dev/badge/Go-1.24-00ADD8.svg?logo=go&logoColor=white) ![Cloudflare](https://1tt.dev/badge/deployed_on-Cloudflare-F38020.svg?logo=cloudflare&logoColor=white)

# 1tt.dev

The developer tools you actually need. Free, fast, no sign-up.

## Tools

**Encoding & Formatting** — JWT parser, JSON beautifier, Base64 codec, SQL formatter, Markdown editor, CSV viewer

**Web & Network** — WebSocket tester, DNS lookup, SSL checker, CORS debugger, OG checker, API tester, IP lookup

**Generators** — QR code generator, badge generator, logo builder, OG image builder, random generators, config generators

**Crypto & Text** — Hash generator, htpasswd generator, regex tester, diff viewer, string tools

**Databases** — PostgreSQL studio (Neon), SQLite browser (Turso), Redis studio (Upstash), Elasticsearch explorer

**Planning** — Planning poker, calendar, pomodoro timer, world clock

**Infrastructure** — Object storage (R2), database tunnels, cloud sync, llms.txt generator

## Stack

![Next.js](https://1tt.dev/badge/Next.js-16-000.svg?logo=nextdotjs&logoColor=white&style=flat-square) ![Tailwind](https://1tt.dev/badge/Tailwind-v4-06B6D4.svg?logo=tailwindcss&logoColor=white&style=flat-square) ![Go](https://1tt.dev/badge/Go-1.24-00ADD8.svg?logo=go&logoColor=white&style=flat-square) ![Cloudflare](https://1tt.dev/badge/Cloudflare-Workers-F38020.svg?logo=cloudflare&logoColor=white&style=flat-square) ![PostgreSQL](https://1tt.dev/badge/PostgreSQL-Neon-4169E1.svg?logo=postgresql&logoColor=white&style=flat-square) ![Redis](https://1tt.dev/badge/Redis-Upstash-DC382D.svg?logo=redis&logoColor=white&style=flat-square)

- **Frontend**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Go API server with langchaingo AI agents
- **Hosting**: Cloudflare Workers (web) + Cloudflare Containers (API)
- **Databases**: Neon (Postgres), Turso (SQLite), Upstash (Redis)
- **Storage**: Cloudflare R2

## Development

```bash
# Install dependencies
just install

# Start frontend + backend
just dev-all

# Or separately
just dev    # Next.js dev server
just api    # Go API server
```

## Links

- **Website**: [1tt.dev](https://1tt.dev)
- **Shop**: [1tt.dev/shop](https://1tt.dev/shop)
- **Guides**: [1tt.dev/guides](https://1tt.dev/guides)
