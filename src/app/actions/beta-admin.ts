"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/staff-auth";
import { BetaFeature } from "@/generated/prisma/client";
import { manualGrant, markFeaturePublic } from "@/lib/beta-gate";

async function requireSuperAdmin() {
  const staff = await requireStaffSession();
  if (staff.role !== "SUPER_ADMIN") throw new Error("Only a Super Admin can manage beta access.");
}

export async function manualGrantAction(email: string, feature: BetaFeature): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const result = await manualGrant(email, feature);
  revalidatePath("/admin/beta-access");
  return result;
}

export async function markFeaturePublicAction(feature: BetaFeature): Promise<{ notified: number }> {
  await requireSuperAdmin();
  const result = await markFeaturePublic(feature);
  revalidatePath("/admin/beta-access");
  return result;
}
