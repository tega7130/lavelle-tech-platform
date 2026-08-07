import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCandidate } from "@/lib/candidate-session";

const PAGE_SIZE = 20;

/**
 * A route handler (not a Server Action) because the notification bell is
 * the one piece of UI in this slice that polls/refetches from the client
 * rather than being read directly in a Server Component (Handoff 01
 * README's server-surface table).
 */
export async function GET(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const cursor = request.nextUrl.searchParams.get("cursor");

  const notifications = await prisma.notification.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > PAGE_SIZE;
  const page = hasMore ? notifications.slice(0, PAGE_SIZE) : notifications;

  return NextResponse.json({
    notifications: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  });
}
