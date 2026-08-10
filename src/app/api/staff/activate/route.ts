import { NextRequest, NextResponse } from "next/server";

/**
 * A GET route handler rather than a Server Action — same reason as
 * /api/auth/verify-email: this arrives as a plain navigation (an email
 * client following the invitation link), which can't carry a POST body.
 * The real validation (form vs expired) happens in the set-password
 * page's own Server Component render, which can re-check on every visit
 * without burning the token's single use — this handler is just the
 * stable link address the invitation email points at.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const setPasswordUrl = new URL("/staff/set-password", request.url);
  if (token) setPasswordUrl.searchParams.set("token", token);
  return NextResponse.redirect(setPasswordUrl);
}
