import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import type { SittingState } from "@/generated/prisma/client";

// A sitting has something to review only once it has actually been
// attempted — REGISTERED/IN_PROGRESS sittings have no conduct trail yet.
const REVIEWABLE_STATES: SittingState[] = ["SUBMITTED", "MARKED", "RELEASED", "FORFEITED", "EXPIRED"];

// The only two kinds this codebase's sitting UI ever actually logs
// (src/components/portal/exam-sitting.tsx) — plain-language labels for
// the event timeline. Any other kind falls back to itself rather than
// guessing at wording the system never sends.
const EVENT_LABEL: Record<string, string> = {
  fullscreen_exit: "Exited full screen",
  tab_switch: "Switched away from the paper",
};

function windowLabel(opensAt: Date, closesAt: Date) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(opensAt)} – ${fmt(closesAt)}`;
}

/** Every exam window that has at least one reviewable sitting — the invigilation screen's window picker (README B2). */
export async function listInvigilationWindows() {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const windows = await prisma.examWindow.findMany({
    include: {
      exam: { include: { programme: { select: { title: true, code: true } } } },
      registrations: { include: { sitting: { select: { state: true } } } },
    },
    orderBy: { opensAt: "desc" },
  });

  return windows
    .map((w) => {
      const reviewableCount = w.registrations.filter((r) => r.sitting && REVIEWABLE_STATES.includes(r.sitting.state)).length;
      return {
        id: w.id,
        label: `${windowLabel(w.opensAt, w.closesAt)} · ${w.exam.programme.title}, ${w.exam.programme.code}`,
        reviewableCount,
      };
    })
    .filter((w) => w.reviewableCount > 0);
}

/** Window-level list: candidate, when they sat, flag count, review status (README B2 "window level"). */
export async function listInvigilationSittings(windowId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const window = await prisma.examWindow.findUniqueOrThrow({
    where: { id: windowId },
    include: { exam: { include: { programme: { select: { title: true, code: true } } } } },
  });

  const registrations = await prisma.examRegistration.findMany({
    where: { windowId, sitting: { state: { in: REVIEWABLE_STATES } } },
    include: {
      candidate: { select: { firstName: true, lastName: true, candidateNumber: true, applicantNumber: true } },
      sitting: { include: { proctoringEvents: { select: { id: true } } } },
    },
    orderBy: { registeredAt: "asc" },
  });

  const rows = registrations
    .filter((r) => r.sitting)
    .map((r) => {
      const sitting = r.sitting!;
      return {
        sittingId: sitting.id,
        name: `${r.candidate.firstName} ${r.candidate.lastName}`,
        candidateNumber: r.candidate.candidateNumber ?? r.candidate.applicantNumber,
        sat: sitting.submittedAt ?? sitting.forfeitedAt,
        flagCount: sitting.proctoringEvents.length,
        conductReview: sitting.conductReview,
      };
    });

  return {
    windowLabel: `${windowLabel(window.opensAt, window.closesAt)} · ${window.exam.programme.title}, ${window.exam.programme.code}`,
    stats: {
      sittings: rows.length,
      withFlags: rows.filter((r) => r.flagCount > 0).length,
      awaitingReview: rows.filter((r) => r.conductReview === "PENDING").length,
      referred: rows.filter((r) => r.conductReview === "REFERRED").length,
    },
    rows,
  };
}

/** Sitting-level record: facts, the plain-language event timeline, and the current finding/outcome (README B2 "sitting level"). */
export async function getSittingConductDetail(sittingId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const sitting = await prisma.sitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: {
      registration: {
        include: { candidate: { select: { firstName: true, lastName: true, candidateNumber: true, applicantNumber: true } } },
      },
      proctoringEvents: { orderBy: { occurredAt: "asc" } },
      reviewedByStaff: { select: { name: true } },
    },
  });

  const durationUsedMinutes =
    sitting.startedAt && sitting.submittedAt ? Math.round((sitting.submittedAt.getTime() - sitting.startedAt.getTime()) / 60_000) : null;

  return {
    id: sitting.id,
    name: `${sitting.registration.candidate.firstName} ${sitting.registration.candidate.lastName}`,
    candidateNumber: sitting.registration.candidate.candidateNumber ?? sitting.registration.candidate.applicantNumber,
    durationUsedMinutes,
    submittedAt: sitting.submittedAt,
    score: sitting.totalPercent,
    flagTotal: sitting.proctoringEvents.length,
    events: sitting.proctoringEvents.map((e) => ({
      id: e.id,
      at: e.occurredAt,
      label: EVENT_LABEL[e.kind] ?? e.kind,
    })),
    conductReview: sitting.conductReview,
    invigilatorFinding: sitting.invigilatorFinding,
    reviewedByStaffName: sitting.reviewedByStaff?.name ?? null,
    reviewedAt: sitting.reviewedAt,
    referredAt: sitting.referredAt,
  };
}
