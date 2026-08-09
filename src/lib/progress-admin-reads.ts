import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computeDeadlineState } from "@/lib/deadline-state";

/** The Progress tab — lecture completion and deadline state per active/completed enrolment. */
export async function getCandidateProgress(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: {
      programme: { select: { title: true, tier: true, modules: { select: { lectures: { select: { id: true } } } } } },
      lectureProgress: { select: { state: true } },
      deadlines: { orderBy: { dueAt: "asc" } },
    },
  });

  return enrolments.map((e) => {
    const totalLectures = e.programme.modules.reduce((sum, m) => sum + m.lectures.length, 0);
    const completedLectures = e.lectureProgress.filter((p) => p.state === "COMPLETED").length;
    return {
      enrolmentId: e.id,
      programmeTitle: e.programme.title,
      tier: e.programme.tier,
      status: e.status,
      percentComplete: totalLectures === 0 ? 0 : Math.round((completedLectures / totalLectures) * 100),
      completedLectures,
      totalLectures,
      deadlines: e.deadlines.map((d) => ({
        id: d.id,
        title: d.title,
        dueAt: d.dueAt,
        state: computeDeadlineState(d),
      })),
    };
  });
}
