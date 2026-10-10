"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { recordAuditEvent } from "@/lib/audit";
import { createPracticeAreaSchema } from "@/lib/validation/practice-area";

export async function listPracticeAreas() {
  return prisma.practiceArea.findMany({ orderBy: { name: "asc" } });
}

/**
 * Mirrors createCategory's "pick existing or create inline" pattern, with
 * one difference: the code is the real identity embedded in every
 * programme's code under this practice area, so unlike a category name a
 * near-miss is never silently reused — a taken code is a hard conflict
 * the admin must resolve by choosing a different one.
 */
export async function createPracticeArea(input: { name: string; code: string }) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const parsed = createPracticeAreaSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid practice area");
  const { name, code } = parsed.data;

  const existingByName = await prisma.practiceArea.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existingByName) return existingByName;

  const existingByCode = await prisma.practiceArea.findUnique({ where: { code } });
  if (existingByCode) {
    throw new Error(`Practice code "${code}" is already used by "${existingByCode.name}". Choose a different code.`);
  }

  const created = await prisma.practiceArea.create({ data: { name, code } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "practice_area",
    subjectId: created.id,
    action: "practice_area.created",
    description: `Created practice area "${created.name}" (${created.code})`,
  });
  revalidatePath("/admin/programmes/new");
  revalidatePath("/admin/programmes/new-future");
  return created;
}
