import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8080";

/**
 * Fetch from the Go API backend. Uses Cloudflare Service Binding
 * when running on Workers, falls back to direct fetch in dev.
 *
 * When API_BACKEND_URL is explicitly set (local dev), always use
 * direct fetch — the OpenNext dev server provides a mock service
 * binding that doesn't actually proxy to the Go backend.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, API_BACKEND_URL);
  const opts: RequestInit = { redirect: "manual", ...init };

  // Only use service binding in production (when no explicit URL is configured)
  if (!process.env.API_BACKEND_URL) {
    try {
      const ctx = await getCloudflareContext();
      const fetcher = (ctx.env as Record<string, unknown>).API_BACKEND as { fetch: typeof fetch } | undefined;
      if (fetcher) {
        return fetcher.fetch(url.toString(), opts);
      }
    } catch {
      // Not on Cloudflare
    }
  }

  return fetch(url.toString(), opts);
}
