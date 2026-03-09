import { betterAuth } from "better-auth";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Use HTTP fetch for Pool queries instead of WebSocket connections.
// This avoids Cloudflare Workers' cross-request I/O restrictions.
neonConfig.poolQueryViaFetch = true;

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
  });
}

// Create a fresh auth instance per property access to avoid
// Cloudflare Workers' cross-request I/O restrictions.
// The Pool is created anew each time so no stale I/O objects leak.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: any = new Proxy(
  {},
  {
    get(_, prop) {
      return (createAuth() as Record<string, unknown>)[prop as string];
    },
  }
);
