import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// No "server-only" guard here, deliberately — matching src/lib/offline-recording.ts's
// precedent. Importing anything with "server-only" (or anything that pulls in
// staff-auth.ts, which reads next/headers via staff-session.ts) breaks under
// plain Node/tsx (the seed script) and under Vitest, both of which lack the
// bundler condition that turns "server-only" into a no-op. Nothing client-side
// ever imports a raw DB-writing lib function directly — Client Components only
// ever call a "use server" Action — so this carries no real safety cost.

type Db = PrismaClient | Prisma.TransactionClient;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * Deadlines are generated at enrolment (rule 6/7), from the intake start
 * date and the authored module structure: one LECTURE_RELEASE deadline
 * per module (module.weekNumber weeks after the intake starts), and a
 * DRAFTING_DUE deadline seven days after each drafting lecture's release.
 * A module with a quiz gets a QUIZ_DUE deadline on that same seven-day
 * mark — the README specifies the drafting formula explicitly but not a
 * quiz one; this mirrors it as the closest documented analogue rather
 * than inventing an unrelated schedule.
 *
 * Called inside the Slice 03 enrolment transaction (pass `tx`) so an
 * enrolled candidate never has an active enrolment with no schedule; also
 * callable standalone (default `prisma`) for the seed script and tests.
 */
export async function generateDeadlinesForEnrolment(enrolmentId: string, db: Db = prisma): Promise<number> {
  const enrolment = await db.enrolment.findUniqueOrThrow({
    where: { id: enrolmentId },
    include: { intake: true },
  });

  const modules = await db.module.findMany({
    where: { programmeId: enrolment.programmeId },
    orderBy: { weekNumber: "asc" },
    include: {
      lectures: { orderBy: { orderIndex: "asc" } },
      quiz: { include: { questions: { select: { id: true } } } },
    },
  });

  const rows: Prisma.DeadlineCreateManyInput[] = [];
  for (const mod of modules) {
    const releaseAt = addDays(enrolment.intake.startsAt, (mod.weekNumber - 1) * 7);
    rows.push({
      enrolmentId,
      kind: "LECTURE_RELEASE",
      moduleId: mod.id,
      title: `${mod.title} opens`,
      dueAt: releaseAt,
      originalDueAt: releaseAt,
    });

    const workDueAt = addDays(releaseAt, 7);
    for (const lec of mod.lectures) {
      if (lec.draftingPrompt) {
        rows.push({
          enrolmentId,
          kind: "DRAFTING_DUE",
          lectureId: lec.id,
          moduleId: mod.id,
          title: `${lec.title} — drafting exercise due`,
          dueAt: workDueAt,
          originalDueAt: workDueAt,
        });
      }
    }

    if (mod.quiz && mod.quiz.questions.length > 0) {
      rows.push({
        enrolmentId,
        kind: "QUIZ_DUE",
        moduleId: mod.id,
        title: `${mod.title} — module quiz due`,
        dueAt: workDueAt,
        originalDueAt: workDueAt,
      });
    }
  }

  if (rows.length > 0) await db.deadline.createMany({ data: rows });
  return rows.length;
}

/**
 * Reactivation extends every deadline that fell inside the suspension
 * window — dueAt between `from` and `to` — by the length of the
 * suspension (rule 8/9). originalDueAt is never touched; the audit trail
 * is the difference between it and the new dueAt. A deadline already met
 * or waived, or one that fell outside the window entirely, is untouched.
 */
export async function extendDeadlinesForSuspension(
  input: { candidateId: string; from: Date; to: Date },
  db: Db = prisma
): Promise<number> {
  const suspensionMs = input.to.getTime() - input.from.getTime();
  if (suspensionMs <= 0) return 0;

  const enrolments = await db.enrolment.findMany({ where: { candidateId: input.candidateId }, select: { id: true } });
  const enrolmentIds = enrolments.map((e) => e.id);
  if (enrolmentIds.length === 0) return 0;

  const affected = await db.deadline.findMany({
    where: {
      enrolmentId: { in: enrolmentIds },
      metAt: null,
      waivedAt: null,
      dueAt: { gte: input.from, lte: input.to },
    },
  });

  if (affected.length === 0) return 0;

  const days = Math.round(suspensionMs / (24 * 60 * 60 * 1000));
  const reason = `Extended by ${days} day${days === 1 ? "" : "s"} — account suspended ${formatDayMonth(input.from)} to ${formatDayMonth(input.to)}`;

  for (const d of affected) {
    await db.deadline.update({
      where: { id: d.id },
      data: { dueAt: new Date(d.dueAt.getTime() + suspensionMs), extendedReason: reason },
    });
  }
  return affected.length;
}
