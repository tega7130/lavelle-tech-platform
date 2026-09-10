import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";

// No "server-only" import here, deliberately — same discipline as
// website-admin-actions.ts, so this stays importable from plain Vitest
// tests. Callers (Server Actions, the admin unmarkComingSoon flow) own
// any auth/permission checks.

export class ListingNotFoundForSubscriptionError extends Error {
  constructor() {
    super("That programme listing doesn't exist.");
    this.name = "ListingNotFoundForSubscriptionError";
  }
}

/**
 * Public, ungated — anyone on a Coming Soon card can leave an email. The
 * unique index on (listingId, email) makes a repeat submission a no-op
 * rather than a duplicate row; a candidate's own account, when signed in,
 * is linked so `My subscriptions` (future) can look them up without an
 * email match.
 */
export async function subscribeToProgrammeNotification(listingId: string, email: string, candidateId?: string) {
  const listing = await prisma.programmeListing.findUnique({ where: { id: listingId }, select: { id: true } });
  if (!listing) throw new ListingNotFoundForSubscriptionError();

  const normalizedEmail = email.trim().toLowerCase();

  try {
    await prisma.programmeNotificationSubscription.create({
      data: { listingId, email: normalizedEmail, candidateId: candidateId ?? null },
    });
  } catch (e) {
    // Already subscribed (and not previously unsubscribed) — treat as
    // success rather than surfacing a "you already did this" error; if
    // they'd unsubscribed, resubscribe them.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await prisma.programmeNotificationSubscription.updateMany({
        where: { listingId, email: normalizedEmail },
        data: { unsubscribedAt: null },
      });
      return;
    }
    throw e;
  }
}

export async function unsubscribeFromProgrammeNotification(subscriptionId: string) {
  await prisma.programmeNotificationSubscription.updateMany({
    where: { id: subscriptionId, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
}

/**
 * Called by unmarkComingSoon once the listing is live. Emails every
 * subscriber who hasn't unsubscribed and hasn't already been notified
 * (so a second "unmark" — mark it coming soon again, then unmark again —
 * never double-emails the same person). Failures are logged per-recipient
 * and don't stop the batch; this runs outside the DB transaction that
 * flipped isComingSoon, so a slow/failed send never rolls back the
 * publish itself.
 */
export async function sendProgrammeGoLiveNotification(listingId: string) {
  const listing = await prisma.programmeListing.findUnique({
    where: { id: listingId },
    include: { programme: { select: { code: true, title: true } } },
  });
  if (!listing) throw new ListingNotFoundForSubscriptionError();

  const subscribers = await prisma.programmeNotificationSubscription.findMany({
    where: { listingId, unsubscribedAt: null, notifiedAt: null },
  });
  if (subscribers.length === 0) return { sent: 0, failed: 0 };

  const programmeUrl = `${process.env.NEXTAUTH_URL}/programmes/${listing.programme.code}`;
  const currentYear = new Date().getFullYear();

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/api/programme-notifications/unsubscribe/${subscriber.id}`;
    const result = await sendTransactionalEmailByTemplate("programme-coming-soon-live", subscriber.email, {
      programmeName: listing.programme.title,
      programmeUrl,
      unsubscribeUrl,
      currentYear,
    });
    if (result.success) {
      sent += 1;
      await prisma.programmeNotificationSubscription.update({
        where: { id: subscriber.id },
        data: { notifiedAt: new Date() },
      });
    } else {
      failed += 1;
      console.error(`sendProgrammeGoLiveNotification: failed to email subscriber ${subscriber.id} for listing ${listingId}`);
    }
  }
  return { sent, failed };
}
