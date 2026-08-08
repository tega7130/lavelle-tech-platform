import { NextRequest, NextResponse } from "next/server";
import { verifyCertificate } from "@/lib/certificate-verify";
import { RateLimitError } from "@/lib/rate-limit";

/**
 * Public, unauthenticated, rate-limited (rule 10) — no session is read
 * here at all. The QR on a printed certificate resolves to /verify with
 * this same number pre-filled; this route is what that page calls.
 *
 * Reads ip/userAgent straight off the request object (like the webhook
 * route does) rather than the next/headers `headers()` global that
 * src/lib/request-info.ts wraps for Server Actions — a Route Handler
 * already has the request, and calling `headers()` outside a real
 * Next-routed request (e.g. invoking this GET directly, as the tests do)
 * throws "called outside a request scope."
 */
export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get("number");
  if (!number || !number.trim()) {
    return NextResponse.json({ error: "number is required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  try {
    const result = await verifyCertificate(number, ip, userAgent);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    throw e;
  }
}
