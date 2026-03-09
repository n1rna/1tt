import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8080";

/**
 * Fetch from the Go API backend. Uses Cloudflare Service Binding
 * when running on Workers, falls back to direct fetch in dev.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = new URL(path, API_BACKEND_URL);

  let fetcher: { fetch: typeof fetch } | undefined;
  try {
    const ctx = await getCloudflareContext();
    fetcher = (ctx.env as Record<string, unknown>).API_BACKEND as { fetch: typeof fetch } | undefined;
  } catch {
    // Not on Cloudflare
  }

  if (fetcher) {
    return fetcher.fetch(url.toString(), init);
  }
  return fetch(url.toString(), init);
}
