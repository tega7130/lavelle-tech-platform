"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import {
  upsertListing as upsertListingLib,
  publishListing as publishListingLib,
  unpublishListing as unpublishListingLib,
  reorderListings as reorderListingsLib,
  type UpsertListingInput,
} from "@/lib/website-admin";

function revalidateSite(code?: string) {
  revalidatePath("/");
  revalidatePath("/contact");
  if (code) revalidatePath(`/programmes/${code}`);
}

export async function upsertListingAction(programmeId: string, input: UpsertListingInput) {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const listing = await upsertListingLib(programmeId, input);
  const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { code: true } });
  revalidateSite(programme?.code);
  revalidatePath("/admin/website");
  return listing;
}

export async function publishListingAction(programmeId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  await publishListingLib(programmeId, staff.id);
  const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { code: true } });
  revalidateSite(programme?.code);
  revalidatePath("/admin/website");
}

export async function unpublishListingAction(programmeId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  await unpublishListingLib(programmeId, trimmed, staff.id);
  const programme = await prisma.programme.findUnique({ where: { id: programmeId }, select: { code: true } });
  revalidateSite(programme?.code);
  revalidatePath("/admin/website");
}

export async function reorderListingsAction(orderedProgrammeIds: string[]) {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  await reorderListingsLib(orderedProgrammeIds);
  revalidateSite();
  revalidatePath("/admin/website");
}
