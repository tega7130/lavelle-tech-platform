import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

export async function listCandidatesForAdmin(q?: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  return prisma.candidate.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { applicantNumber: { contains: q, mode: "insensitive" } },
            { candidateNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getCandidateForAdmin(id: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  return prisma.candidate.findUnique({ where: { id }, include: { profile: true } });
}
