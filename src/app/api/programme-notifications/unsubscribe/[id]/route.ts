import { NextRequest, NextResponse } from "next/server";
import { unsubscribeFromProgrammeNotification } from "@/lib/programme-notifications";

/**
 * A GET route handler, not a Server Action — this arrives as a plain
 * navigation from an email client following the unsubscribe link, same
 * discipline as /api/auth/verify-email. The subscription id itself is
 * the bearer token: a UUID, unguessable, and scoped to exactly one
 * subscription row, so no further auth is needed to act on it.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await unsubscribeFromProgrammeNotification(id);
  return NextResponse.redirect(new URL("/programme-notifications/unsubscribed", _request.url));
}
