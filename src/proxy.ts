import { NextResponse, type NextRequest } from "next/server";
import { CANDIDATE_SESSION_COOKIE, resolveCandidateFromToken } from "@/lib/candidate-session";
import { isGatedPortalPath } from "@/lib/candidate-nav";
import { STAFF_SESSION_COOKIE, resolveStaffFromToken } from "@/lib/staff-session";

/**
 * Layer 1 of the three-layer applicant gate (Handoff 01 rule 5) —
 * "middleware... plus a re-check in the gated route segments... middleware
 * alone is not an authorisation boundary." Proxy defaults to the Node.js
 * runtime as of Next 16, so this does a real DB-backed session check
 * rather than a cookie-presence guess; layers 2 (the gated pages'
 * Server Components) and 3 (requireEnrolled() in Server Actions) still
 * re-check independently — this is a courtesy layer, not the boundary.
 * Same discipline applies to /admin below, against the staff session.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal")) {
    const token = request.cookies.get(CANDIDATE_SESSION_COOKIE)?.value;
    const candidate = token ? await resolveCandidateFromToken(token) : null;
    if (!candidate) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    if (isGatedPortalPath(pathname) && !candidate.isEnrolled) {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
    const staff = token ? await resolveStaffFromToken(token) : null;
    if (!staff) {
      return NextResponse.redirect(new URL("/staff/sign-in", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
