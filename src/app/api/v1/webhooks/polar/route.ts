import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-fetch";

export async function POST(req: NextRequest) {
  const body = await req.arrayBuffer();

  const forwardHeaders: Record<string, string> = {};
  for (const key of ["content-type", "webhook-id", "webhook-timestamp", "webhook-signature"]) {
    const value = req.headers.get(key);
    if (value) forwardHeaders[key] = value;
  }

  try {
    const res = await apiFetch("/api/v1/webhooks/polar", {
      method: "POST",
      headers: forwardHeaders,
      body,
    });

    return new NextResponse(res.body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "backend unavailable" }, { status: 502 });
  }
}
