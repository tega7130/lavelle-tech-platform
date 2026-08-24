"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import { resetEnrolmentProgress } from "@/lib/candidate-progress";

export async function resetEnrolmentProgressAction(enrolmentId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.RESET_CANDIDATE_PROGRESS);

  const enrolment = await prisma.enrolment.findUniqueOrThrow({
    where: { id: enrolmentId },
    select: { programmeId: true, candidateId: true },
  });

  await resetEnrolmentProgress(enrolmentId, reason, staff.id);

  revalidatePath(`/admin/programmes/${enrolment.programmeId}/enrolments`);
  revalidatePath(`/admin/candidates/${enrolment.candidateId}`);
}
