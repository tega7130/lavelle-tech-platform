import { NextRequest, NextResponse } from "next/server";
import { expireOverdueSittings } from "@/lib/exam-sitting-actions";

/**
 * Sweeps sittings past expiresAt (rule 4/7) — expiry is not forfeiture:
 * this marks the sitting on what was answered, exactly like a normal
 * submission, rather than leaving it stranded IN_PROGRESS forever.
 * Bearer-token gated when CRON_SECRET is set (the deploy target's cron
 * scheduler sends it); unauthenticated in local dev, where nothing else
 * can reach this route anyway.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expiredCount = await expireOverdueSittings();
  return NextResponse.json({ ok: true, expiredCount });
}
