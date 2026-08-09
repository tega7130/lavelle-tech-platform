import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAnnouncement } from "@/lib/announcements";

/**
 * Sweeps announcements past scheduledFor — same audience-freezing send
 * path a manual "Send now" click uses (rule 8), attributed to whoever
 * scheduled it. Bearer-token gated when CRON_SECRET is set, same
 * convention as /api/cron/expire-sittings.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await prisma.announcement.findMany({
    where: { state: "SCHEDULED", scheduledFor: { lte: new Date() } },
    select: { id: true, createdByStaffId: true },
  });

  let sentCount = 0;
  for (const announcement of due) {
    await sendAnnouncement(announcement.id, announcement.createdByStaffId);
    sentCount += 1;
  }

  return NextResponse.json({ ok: true, sentCount });
}
