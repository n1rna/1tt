import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-fetch";

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const accept = req.headers.get("accept") || "";

  const isBrowser = accept.includes("text/html") && !ua.toLowerCase().includes("curl");
  if (isBrowser) {
    return NextResponse.redirect(new URL("/tools/ip", req.url));
  }

  const xff = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  try {
    const res = await apiFetch("/api/v1/ip/info", {
      headers: { "x-forwarded-for": xff },
    });
    const data = await res.text();
    return new NextResponse(data, {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
