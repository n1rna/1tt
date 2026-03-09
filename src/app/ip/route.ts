import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-fetch";

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const accept = req.headers.get("accept") || "";

  // If browser request, redirect to the tool page
  const isBrowser = accept.includes("text/html") && !ua.toLowerCase().includes("curl");
  if (isBrowser) {
    return NextResponse.redirect(new URL("/tools/ip", req.url));
  }

  // Forward to Go backend
  const xff = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  try {
    const res = await apiFetch("/api/v1/ip", {
      headers: { "x-forwarded-for": xff },
    });
    const text = await res.text();
    return new NextResponse(text, {
      headers: { "content-type": "text/plain" },
    });
  } catch {
    return new NextResponse("Error fetching IP\n", { status: 502 });
  }
}
