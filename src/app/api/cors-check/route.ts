import { NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // skip in dev if not configured
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token }),
    }
  );
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

const CORS_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "access-control-max-age",
  "access-control-expose-headers",
  "vary",
] as const;

function pickCorsHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of CORS_HEADERS) {
    const value = headers.get(name);
    if (value !== null) {
      result[name] = value;
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  let body: { url?: string; origin?: string; method?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, origin = "https://example.com", method = "GET", turnstileToken } = body;

  if (!turnstileToken) {
    return NextResponse.json({ error: "Please complete the verification" }, { status: 400 });
  }

  const valid = await verifyTurnstile(turnstileToken);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 403 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http and https URLs are supported" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const commonHeaders = {
    Origin: origin,
    "User-Agent": "1tt-cors-debugger/1.0",
  };

  try {
    // OPTIONS preflight request
    let preflightHeaders: Record<string, string> = {};
    let preflightStatus: number | null = null;
    let preflightError: string | null = null;

    try {
      const preflightRes = await fetch(parsedUrl.toString(), {
        method: "OPTIONS",
        headers: {
          ...commonHeaders,
          "Access-Control-Request-Method": method,
          "Access-Control-Request-Headers": "content-type",
        },
        signal: controller.signal,
      });
      preflightStatus = preflightRes.status;
      preflightHeaders = pickCorsHeaders(preflightRes.headers);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "Request timed out after 10 seconds" }, { status: 504 });
      }
      preflightError = err instanceof Error ? err.message : "OPTIONS request failed";
    }

    // GET (or simulated method) request — always use GET on the wire so we get a real response
    let actualHeaders: Record<string, string> = {};
    let actualStatus: number | null = null;
    let actualError: string | null = null;

    try {
      const actualRes = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: commonHeaders,
        signal: controller.signal,
      });
      actualStatus = actualRes.status;
      actualHeaders = pickCorsHeaders(actualRes.headers);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "Request timed out after 10 seconds" }, { status: 504 });
      }
      actualError = err instanceof Error ? err.message : "GET request failed";
    }

    clearTimeout(timeout);

    return NextResponse.json({
      url: parsedUrl.toString(),
      origin,
      method,
      preflight: {
        status: preflightStatus,
        headers: preflightHeaders,
        error: preflightError,
      },
      actual: {
        status: actualStatus,
        headers: actualHeaders,
        error: actualError,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out after 10 seconds" }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
