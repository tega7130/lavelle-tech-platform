import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const INVITATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours — a real invitation, no urgency to rush the invitee.
/** Shorter-lived than an invitation (README-style rule: a password reset grants entry to an EXISTING account, so it should not stay valid as long as a first-time invitation). Matches the expiryMinutes sent to the admin-password-reset-request email template. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Inserts the token row (hash only) and returns the plaintext — mirrors
 * verification-token.ts's createVerificationTokenRecord. invitedByStaffId
 * is omitted for a self-service password reset; set for a real invitation.
 * ttlMs defaults to the 48-hour invitation window; pass PASSWORD_RESET_TOKEN_TTL_MS
 * for the shorter-lived password-reset case — same table, same shape, just a
 * different expiry for a different risk profile.
 */
export async function createInvitationTokenRecord(
  db: Db,
  staffId: string,
  invitedByStaffId?: string,
  ttlMs: number = INVITATION_TOKEN_TTL_MS
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.staffInvitationToken.create({
    data: {
      staffId,
      invitedByStaffId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

/**
 * Same honest dev stand-in as verification-token.ts's logVerificationEmail
 * — no email provider is wired up anywhere in this app, so the link lands
 * in the server log rather than a fabricated "sent" that goes nowhere.
 */
export function logStaffInvitationEmail(email: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/staff/activate?token=${token}`;
  console.log(`[dev] staff invitation for ${email}: ${url}`);
}

/** Resending invalidates every outstanding token for that staff member first — two live links for one account is a security hole (README A2). */
export async function invalidateOutstandingStaffTokens(staffId: string, db: Db = prisma) {
  await db.staffInvitationToken.updateMany({
    where: { staffId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export interface InvitationTokenPreview {
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  /** Null for a self-service password reset — there is no inviter to name. */
  invitedByName: string | null;
  expiresAt: Date;
}

/**
 * Read-only lookup for rendering the set-password page (form vs expired)
 * without consuming the token — a page render must be able to show the
 * form repeatedly (re-render on validation error) without burning the
 * single use itself. Returns null for missing/expired/already-consumed.
 */
export async function previewInvitationToken(plaintextToken: string): Promise<InvitationTokenPreview | null> {
  const tokenHash = hashToken(plaintextToken);
  const record = await prisma.staffInvitationToken.findFirst({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    include: { staff: true, invitedByStaff: { select: { name: true } } },
  });
  if (!record) return null;
  return {
    staffId: record.staffId,
    staffName: record.staff.name,
    staffEmail: record.staff.email,
    staffRole: record.staff.role,
    invitedByName: record.invitedByStaff?.name ?? null,
    expiresAt: record.expiresAt,
  };
}

/**
 * The consuming half — called from INSIDE setStaffPassword's single
 * activation transaction (README A5 rule 3: password, status, activatedAt,
 * token consumption and session creation all succeed or all fail
 * together). Re-validates against the same criteria as previewInvitationToken
 * within the transaction, so a token consumed by a racing request can't
 * activate twice. Returns null for missing/expired/already-consumed.
 */
export async function consumeInvitationToken(tx: Prisma.TransactionClient, plaintextToken: string): Promise<{ staffId: string } | null> {
  const tokenHash = hashToken(plaintextToken);
  const record = await tx.staffInvitationToken.findFirst({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record) return null;
  await tx.staffInvitationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { staffId: record.staffId };
}
