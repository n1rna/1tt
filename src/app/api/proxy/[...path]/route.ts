import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { apiFetch } from "@/lib/api-fetch";

const API_BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8080";

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = path.join("/");

  // Build URL path with query params
  const url = new URL(`/api/v1/${targetPath}`, API_BACKEND_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Get session from better-auth
  const session = await auth.api.getSession({ headers: await headers() });

  // Build forwarded headers
  const forwardHeaders: Record<string, string> = {
    "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders["content-type"] = contentType;
  }

  if (session?.session) {
    forwardHeaders["x-session-token"] = session.session.token;
    forwardHeaders["x-user-id"] = session.user.id;
  }

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined;

  try {
    const response = await apiFetch(url.pathname + url.search, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
