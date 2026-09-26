// No "server-only" import here, deliberately — same discipline as
// enrolment-transaction.ts and player-actions.ts, so this file stays
// importable from Vitest/scripts. Every export here is already only
// ever called from a "use server" action file.
import { prisma } from "@/lib/prisma";
import { BetaFeature, BetaSignupStatus, BetaFeedbackKind, NotificationCategory } from "@/generated/prisma/client";

// Temporary one-week beta capacity gate on two features (Programme
// enrolment, Document Library purchase). See the schema.prisma comment
// above the BetaFeature enum for what to remove when the beta ends —
// this file is the only other place that references these tables.

const SLOTS_PER_FEATURE = 10;

async function countGranted(feature: BetaFeature): Promise<number> {
  return prisma.betaFeatureSignup.count({ where: { feature, status: BetaSignupStatus.GRANTED } });
}

async function getSignup(candidateId: string, feature: BetaFeature) {
  return prisma.betaFeatureSignup.findUnique({ where: { candidateId_feature: { candidateId, feature } } });
}

async function ensureWaitlisted(candidateId: string, feature: BetaFeature) {
  await prisma.betaFeatureSignup.upsert({
    where: { candidateId_feature: { candidateId, feature } },
    create: { candidateId, feature, status: BetaSignupStatus.WAITLISTED },
    update: {},
  });
}

async function ensureGranted(candidateId: string, feature: BetaFeature, source: "AUTO" | "MANUAL") {
  await prisma.betaFeatureSignup.upsert({
    where: { candidateId_feature: { candidateId, feature } },
    create: { candidateId, feature, status: BetaSignupStatus.GRANTED, source },
    update: { status: BetaSignupStatus.GRANTED, source },
  });
}

/**
 * Call before checkout is ever created. Returns `false` when the
 * candidate should be blocked and shown the waitlist screen instead of
 * proceeding — waitlists them as a side effect. When `grantImmediately`
 * is true (Document Library — online payment only, no multi-day
 * confirmation window) an available slot is claimed right here. When
 * false (Programme — offline payment methods can take days to confirm),
 * this only blocks obviously-full signups early; the real grant happens
 * in recordConfirmedPayment below, so nobody who actually pays is ever
 * told afterward that they've been waitlisted.
 */
export async function gateBeforeCheckout(
  candidateId: string,
  feature: BetaFeature,
  opts: { grantImmediately: boolean }
): Promise<boolean> {
  const existing = await getSignup(candidateId, feature);
  if (existing?.status === BetaSignupStatus.GRANTED) return true;

  const granted = await countGranted(feature);
  if (granted < SLOTS_PER_FEATURE) {
    if (opts.grantImmediately) await ensureGranted(candidateId, feature, "AUTO");
    return true;
  }

  await ensureWaitlisted(candidateId, feature);
  return false;
}

/**
 * Called after a payment for this feature has actually been confirmed
 * (never before). Always grants — a candidate who has genuinely paid is
 * never rejected after the fact, even if the 10 slots filled up while
 * their (possibly offline) payment was in flight. Best-effort by design:
 * callers wrap this in try/catch so a failure here can never affect the
 * payment/enrolment transaction it follows.
 */
export async function recordConfirmedPayment(candidateId: string, feature: BetaFeature): Promise<void> {
  const existing = await getSignup(candidateId, feature);
  if (existing?.status === BetaSignupStatus.GRANTED) return;
  await ensureGranted(candidateId, feature, "AUTO");
}

/**
 * Should the blocking "how was it" modal show right now? True only once
 * per candidate per feature — the modal is un-dismissable without
 * submitting, so the existence of a COMPLETION feedback row is itself
 * proof it already ran.
 */
export async function shouldShowCompletionFeedback(candidateId: string, feature: BetaFeature): Promise<boolean> {
  const signup = await getSignup(candidateId, feature);
  if (signup?.status !== BetaSignupStatus.GRANTED) return false;

  const feedback = await prisma.betaFeedback.findFirst({
    where: { candidateId, feature, kind: BetaFeedbackKind.COMPLETION },
    select: { id: true },
  });
  return !feedback;
}

/** Has this waitlisted candidate already left "what would make you interested" feedback? */
export async function hasWaitlistFeedback(candidateId: string, feature: BetaFeature): Promise<boolean> {
  const feedback = await prisma.betaFeedback.findFirst({
    where: { candidateId, feature, kind: BetaFeedbackKind.WAITLIST_INTEREST },
    select: { id: true },
  });
  return !!feedback;
}

export async function submitBetaFeedback(
  candidateId: string,
  feature: BetaFeature,
  kind: BetaFeedbackKind,
  message: string
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Feedback message is required.");
  const signup = await getSignup(candidateId, feature);
  await prisma.betaFeedback.create({
    data: { candidateId, feature, kind, message: trimmed, signupId: signup?.id ?? null },
  });
}

// ─── Admin-facing reads/actions ─────────────────────────────────────────

export async function getFeatureSummary(feature: BetaFeature) {
  const [granted, waitlisted] = await Promise.all([
    prisma.betaFeatureSignup.count({ where: { feature, status: BetaSignupStatus.GRANTED } }),
    prisma.betaFeatureSignup.count({ where: { feature, status: BetaSignupStatus.WAITLISTED } }),
  ]);
  return { granted, waitlisted, slots: SLOTS_PER_FEATURE };
}

export async function listSignups(feature: BetaFeature) {
  return prisma.betaFeatureSignup.findMany({
    where: { feature },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
      feedback: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function manualGrant(email: string, feature: BetaFeature): Promise<{ ok: true } | { ok: false; error: string }> {
  const candidate = await prisma.candidate.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!candidate) return { ok: false, error: "No candidate found with that email." };
  await ensureGranted(candidate.id, feature, "MANUAL");
  return { ok: true };
}

/**
 * Marks a feature public: every WAITLISTED candidate for it gets one
 * in-app notification and notifiedPublicAt set. Does not touch anything
 * else — going fully public (removing the gate in code) is a separate,
 * later step.
 */
export async function markFeaturePublic(feature: BetaFeature): Promise<{ notified: number }> {
  const waitlisted = await prisma.betaFeatureSignup.findMany({
    where: { feature, status: BetaSignupStatus.WAITLISTED, notifiedPublicAt: null },
    select: { id: true, candidateId: true },
  });

  const label = feature === BetaFeature.PROGRAMME ? "Course enrolment" : "The Document Library";

  for (const row of waitlisted) {
    await prisma.$transaction([
      prisma.notification.create({
        data: {
          candidateId: row.candidateId,
          category: NotificationCategory.ANNOUNCEMENT,
          title: "It's open!",
          body: `${label} is now open to everyone — you're free to go ahead whenever you're ready.`,
        },
      }),
      prisma.betaFeatureSignup.update({ where: { id: row.id }, data: { notifiedPublicAt: new Date() } }),
    ]);
  }

  return { notified: waitlisted.length };
}
