import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { intakeLabel } from "@/lib/format";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// No "server-only" here, deliberately — same discipline as
// deadline-generation.ts and enrolment-transaction.ts, so this stays
// importable from Vitest without dragging in staff-auth's next/headers.

type Db = PrismaClient | Prisma.TransactionClient;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** The three real intake months, each with its next-upcoming occurrence — never all twelve months, since only these three exist. */
export async function listUpcomingIntakes(db: Db = prisma) {
  const intakes = await db.intake.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const nextByMonth = new Map<string, (typeof intakes)[number]>();
  for (const intake of intakes) {
    if (!nextByMonth.has(intake.month)) nextByMonth.set(intake.month, intake);
  }
  return [...nextByMonth.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export class NoRoomForTransferError extends Error {
  constructor() {
    super("No cohort has room in the target intake — the transfer was not made.");
    this.name = "NoRoomForTransferError";
  }
}

/**
 * Moves one enrolment to a new intake/cohort — module release deadlines
 * and every not-yet-met drafting/quiz deadline are recalculated against
 * the new intake's start date using the exact same formula
 * generateDeadlinesForEnrolment used to create them (rule: same schedule
 * math everywhere, never a second formula that can drift). A deadline
 * already met keeps its history untouched. Unlike ordinary enrolment,
 * a transfer with no cohort room is refused outright rather than left
 * pending — an admin doing this deliberately needs to know immediately,
 * not discover it later in the audit log.
 */
export async function transferCandidateIntake(
  enrolmentId: string,
  newIntakeId: string,
  actorStaffId: string,
  ipAddress: string | null
) {
  return prisma.$transaction(async (tx) => {
    const enrolment = await tx.enrolment.findUniqueOrThrow({
      where: { id: enrolmentId },
      include: { intake: true, programme: true, candidate: { select: { firstName: true, lastName: true } } },
    });
    const newIntake = await tx.intake.findUniqueOrThrow({ where: { id: newIntakeId } });

    const cohortRows = await tx.$queryRaw<{ id: string; capacity: number }[]>`
      SELECT id, capacity FROM "Cohort"
      WHERE "programmeId" = ${enrolment.programmeId} AND "intakeId" = ${newIntakeId}
      ORDER BY "createdAt" ASC
      FOR UPDATE
    `;
    let assignedCohortId: string | null = null;
    for (const c of cohortRows) {
      const occupied = await tx.enrolment.count({
        where: { cohortId: c.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      });
      if (occupied < c.capacity) {
        assignedCohortId = c.id;
        break;
      }
    }
    if (!assignedCohortId) throw new NoRoomForTransferError();

    await tx.enrolment.update({ where: { id: enrolmentId }, data: { intakeId: newIntakeId, cohortId: assignedCohortId } });

    const modules = await tx.module.findMany({ where: { programmeId: enrolment.programmeId }, select: { id: true, weekNumber: true } });
    const weekByModule = new Map(modules.map((m) => [m.id, m.weekNumber]));
    const outstanding = await tx.deadline.findMany({ where: { enrolmentId, metAt: null } });

    if (!enrolment.intake) throw new Error("Cannot transfer an enrolment without an assigned intake.");
    const oldLabel = intakeLabel(enrolment.intake.month, enrolment.intake.year);
    const newLabel = intakeLabel(newIntake.month, newIntake.year);
    let moved = 0;
    for (const d of outstanding) {
      const weekNumber = d.moduleId ? weekByModule.get(d.moduleId) : null;
      if (weekNumber == null) continue;
      const releaseAt = addDays(newIntake.startsAt, (weekNumber - 1) * 7);
      const newDueAt = d.kind === "LECTURE_RELEASE" ? releaseAt : addDays(releaseAt, 7);
      await tx.deadline.update({
        where: { id: d.id },
        data: { dueAt: newDueAt, waivedAt: null, extendedReason: `Moved to the ${newLabel} intake on cohort transfer` },
      });
      moved++;
    }

    const holderName = `${enrolment.candidate.firstName} ${enrolment.candidate.lastName}`;
    await recordAuditEvent(tx, {
      actorStaffId,
      subjectType: "enrolment",
      subjectId: enrolmentId,
      action: "enrolment.intake_transferred",
      description: `Transferred ${holderName}'s ${enrolment.programme.title} enrolment from the ${oldLabel} intake to ${newLabel} — ${moved} outstanding deadline${moved === 1 ? "" : "s"} recalculated`,
      ipAddress,
    });
    await tx.notification.create({
      data: {
        candidateId: enrolment.candidateId,
        category: "PROGRAMME",
        title: "Your cohort has changed",
        body: `You have been moved to the ${newLabel} intake for ${enrolment.programme.title}. Your deadlines have been recalculated against the new cohort calendar.`,
      },
    });

    return { enrolmentId, newLabel };
  });
}
