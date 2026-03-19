/**
 * Custom worker entry point that wraps the OpenNext worker.
 * Intercepts WebSocket upgrade requests for /ws/* paths and proxies them
 * to the Go API backend via the service binding, keeping the backend private.
 */

// Import the OpenNext worker
import nextWorker from "./.open-next/worker.js";

interface Env {
  API_BACKEND: { fetch: typeof fetch };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Intercept WebSocket upgrade requests to /ws/*
    if (url.pathname.startsWith("/ws/") && request.headers.get("Upgrade") === "websocket") {
      return handleWebSocketProxy(request, env, url);
    }

    // Everything else goes to OpenNext
    return (nextWorker as { fetch: typeof fetch }).fetch(request, env, ctx);
  },
};

async function handleWebSocketProxy(request: Request, env: Env, url: URL): Promise<Response> {
  // Map /ws/poker?session=X&name=Y -> /api/v1/poker/ws?session=X&name=Y
  const path = url.pathname.replace(/^\/ws\//, "/api/v1/") + "/ws";
  const backendUrl = new URL(path + url.search, "http://api-backend");

  // Forward the request to the API backend service binding
  const fetcher = env.API_BACKEND;
  if (!fetcher) {
    return new Response("API backend not configured", { status: 503 });
  }

  // Create a new request preserving the upgrade headers
  const proxyReq = new Request(backendUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  return fetcher.fetch(proxyReq);
}
