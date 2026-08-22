import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { ProgrammeStatus, EnrolmentStatus, type ProgrammeTier } from "@/generated/prisma/client";

// Candidate-facing server functions — called directly from Server
// Components, no client fetch.

export interface ListCatalogueParams {
  q?: string;
  tier?: ProgrammeTier;
  categoryId?: string;
  feeMax?: number;
}

/** Only ACTIVE programmes, each annotated with the viewer's own enrolment state so a card can read "Enrolled" rather than "Enrol now". */
export async function listCatalogue(params: ListCatalogueParams = {}) {
  const candidate = await getCurrentCandidate();

  const programmes = await prisma.programme.findMany({
    where: {
      status: ProgrammeStatus.ACTIVE,
      ...(params.q
        ? { OR: [{ title: { contains: params.q, mode: "insensitive" } }, { summary: { contains: params.q, mode: "insensitive" } }] }
        : {}),
      ...(params.tier ? { tier: params.tier } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.feeMax != null ? { feeMinor: { lte: params.feeMax } } : {}),
    },
    include: { category: true },
    orderBy: { title: "asc" },
  });

  let enrolledProgrammeIds = new Set<string>();
  if (candidate && programmes.length > 0) {
    const rows = await prisma.enrolment.findMany({
      where: {
        candidateId: candidate.id,
        programmeId: { in: programmes.map((p) => p.id) },
        status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] },
      },
      select: { programmeId: true },
    });
    enrolledProgrammeIds = new Set(rows.map((r) => r.programmeId));
  }

  return programmes.map((p) => ({ ...p, viewerEnrolled: enrolledProgrammeIds.has(p.id) }));
}

/**
 * Public-safe (rule 12): titles and structure only — never slide bodies,
 * narration URLs or video URLs. This is the paid product and the detail
 * endpoint is the obvious leak, so the select list below is the actual
 * enforcement, not just a rendering choice.
 */
export async function getProgrammeDetail(code: string) {
  const programme = await prisma.programme.findUnique({
    where: { code },
    include: {
      category: true,
      modules: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          weekNumber: true,
          summary: true,
          lectures: {
            orderBy: { orderIndex: "asc" },
            select: { id: true, title: true, mediaKind: true },
          },
        },
      },
      assessmentWeightings: true,
      coverVideoAsset: { select: { storageKey: true } },
    },
  });
  if (!programme || programme.status !== ProgrammeStatus.ACTIVE) return null;

  const candidate = await getCurrentCandidate();
  let viewerEnrolled = false;
  if (candidate) {
    const enrolment = await prisma.enrolment.findFirst({
      where: {
        candidateId: candidate.id,
        programmeId: programme.id,
        status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] },
      },
    });
    viewerEnrolled = !!enrolment;
  }

  return { ...programme, viewerEnrolled };
}

/**
 * Polled by the return-from-provider page — the actual authority on
 * whether a payment succeeded (rule 6). Scoped to the owning candidate
 * only, so a guessed or shared reference can't leak another candidate's
 * payment state.
 */
export async function getPaymentStatus(internalReference: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return null;

  const payment = await prisma.payment.findUnique({
    where: { internalReference },
    select: {
      id: true,
      candidateId: true,
      status: true,
      confirmedAt: true,
      failedAt: true,
      failureReason: true,
      enrolmentId: true,
      enrolment: { select: { programme: { select: { code: true, title: true } } } },
    },
  });
  if (!payment || payment.candidateId !== candidate.id) return null;
  return payment;
}

/**
 * The guest-checkout counterpart to getPaymentStatus — polled by the
 * unauthenticated return page for someone who paid via "Apply for this
 * programme" before any account existed. There is no session to scope
 * ownership by, so both the reference AND the checkoutToken (a random
 * secret, not the 5-digit-suffix reference alone) must match, or this
 * returns null exactly as if the payment didn't exist.
 */
export async function getGuestCheckoutStatus(internalReference: string, checkoutToken: string) {
  const payment = await prisma.payment.findUnique({
    where: { internalReference },
    select: {
      id: true,
      status: true,
      confirmedAt: true,
      failedAt: true,
      failureReason: true,
      enrolment: { select: { programme: { select: { code: true, title: true } } } },
      // The programme is also reachable straight off GuestCheckout (set at
      // checkout, before any Enrolment exists) — needed for a "try again"
      // link on a FAILED payment, where enrolment is still null because
      // confirmPayment's guest branch never ran.
      guestCheckout: { select: { checkoutToken: true, email: true, programme: { select: { code: true, title: true } } } },
    },
  });
  if (!payment || !payment.guestCheckout || payment.guestCheckout.checkoutToken !== checkoutToken) return null;
  return {
    ...payment,
    email: payment.guestCheckout.email,
    programme: payment.enrolment?.programme ?? payment.guestCheckout.programme,
  };
}

/** The enrolled dashboard's data — candidate number, cohort placement and ID card. */
export async function getEnrolledSummary(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    include: { programme: true, cohort: true, intake: true },
    orderBy: { enrolledAt: "desc" },
  });
  const idCard = await prisma.idCard.findFirst({ where: { candidateId, retiredAt: null } });
  return { enrolments, idCard };
}
