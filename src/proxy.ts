import { NextResponse, type NextRequest } from "next/server";
import { CANDIDATE_SESSION_COOKIE, resolveCandidateFromToken } from "@/lib/candidate-session";
import { isGatedPortalPath } from "@/lib/candidate-nav";
import { STAFF_SESSION_COOKIE, resolveStaffFromToken } from "@/lib/staff-session";

/**
 * A cookie that existed but no longer resolves is an EXPIRY, not a first
 * visit (Slice 11 Part H rule 16) — carries `next` so signing back in
 * restores the exact page, and `expired=1` so the sign-in page shows the
 * session-expired state instead of a bare form.
 */
function expiredRedirectUrl(signInPath: string, hadToken: string | undefined, pathname: string, base: string) {
  const url = new URL(signInPath, base);
  if (hadToken) {
    url.searchParams.set("expired", "1");
    url.searchParams.set("next", pathname);
  }
  return url;
}

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
      // Slice 11 Part H rule 16: a token that existed but no longer
      // resolves is (session policy aside) an EXPIRY, not a first visit —
      // the sign-in page shows the session-expired state and, on
      // success, returns the candidate to this exact path.
      return NextResponse.redirect(expiredRedirectUrl("/sign-in", token, pathname, request.url));
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
      return NextResponse.redirect(expiredRedirectUrl("/staff/sign-in", token, pathname, request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
