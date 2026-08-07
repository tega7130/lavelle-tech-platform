import { NextRequest, NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verification-token";

/**
 * A GET route handler rather than a Server Action because this arrives
 * as a plain navigation (an email client following a link), which can't
 * carry a POST body — one of the two documented uses for route handlers
 * in this slice (Handoff 01 README).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const dashboardUrl = new URL("/portal/dashboard", request.url);

  if (!token) {
    dashboardUrl.searchParams.set("verified", "0");
    return NextResponse.redirect(dashboardUrl);
  }

  const result = await consumeVerificationToken(token);
  dashboardUrl.searchParams.set("verified", result.ok ? "1" : "0");
  return NextResponse.redirect(dashboardUrl);
}
