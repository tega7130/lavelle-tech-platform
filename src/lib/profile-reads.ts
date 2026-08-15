import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCandidateIdCard(candidateId: string) {
  return prisma.idCard.findFirst({ where: { candidateId, retiredAt: null } });
}
