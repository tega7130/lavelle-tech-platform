import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEventInput {
  actorStaffId?: string | null;
  subjectType: string;
  subjectId: string;
  action: string;
  description: string;
  reason?: string | null;
  ipAddress?: string | null;
}

/** Append-only by DB grant (see prisma/migrations/*_app_role_audit_grants) — this is the only way rows get written. */
export async function recordAuditEvent(db: Db, input: AuditEventInput) {
  await db.auditEvent.create({ data: input });
}
