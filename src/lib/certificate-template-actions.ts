import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import type { ProgrammeTier, Prisma } from "@/generated/prisma/client";

// Plain, no "server-only" — same discipline as certificate-actions.ts.

export interface CreateTemplateRevisionInput {
  name: string;
  artworkAssetId: string;
  appliesToTier: ProgrammeTier | null;
  signatoryBlock: string;
  printedFields: Prisma.InputJsonValue;
}

/** Templates are never edited in place (rule 9) — always a new row, isActive false until explicitly activated. */
export async function createTemplateRevision(input: CreateTemplateRevisionInput, staffId: string) {
  return prisma.certificateTemplate.create({
    data: {
      name: input.name,
      artworkAssetId: input.artworkAssetId,
      appliesToTier: input.appliesToTier,
      signatoryBlock: input.signatoryBlock,
      printedFields: input.printedFields,
      isActive: false,
      createdByStaffId: staffId,
    },
  });
}

/**
 * Deactivates the previous active template in the SAME tier scope
 * (rule: one active per tier scope) and activates this one. Issued
 * certificates keep the templateId they were printed with (rule 9) —
 * this never touches Certificate rows, only CertificateTemplate ones.
 */
export async function activateTemplate(id: string, staffId: string, ipAddress: string | null) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.certificateTemplate.findUniqueOrThrow({ where: { id } });

    await tx.certificateTemplate.updateMany({
      where: { appliesToTier: template.appliesToTier, isActive: true, id: { not: id } },
      data: { isActive: false },
    });

    const now = new Date();
    const updated = await tx.certificateTemplate.update({
      where: { id },
      data: { isActive: true, activatedAt: now },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "certificate_template",
      subjectId: id,
      action: "certificate_template.activated",
      description: `Activated template "${template.name}"`,
      ipAddress,
    });

    return updated;
  });
}
