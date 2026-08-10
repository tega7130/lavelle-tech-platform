import "server-only";
import { cache } from "react";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import type { Permission, Prisma, PrismaClient, StaffRole, StaffStatus } from "@/generated/prisma/client";

/**
 * Database-backed staff sessions — Slice 10 replaces the NextAuth JWT
 * strategy this app started with. Same table as candidate-session.ts
 * (Session.staffId alongside Session.candidateId, exactly one non-null
 * per row — see the schema comment), but a SEPARATE cookie, a SEPARATE
 * hashing secret, and a SEPARATE read path: a candidate signing out
 * must never touch an admin session on the same machine, and vice versa
 * (README A1). The two "auth systems" are one revocation mechanism
 * wearing two cookies, not two mechanisms.
 */

export const STAFF_SESSION_COOKIE = "lavelle_staff_session";
const COOKIE_NAME = STAFF_SESSION_COOKIE;
// Slice 11 Part H: 24 hours absolute, no idle timeout — symmetrical with
// candidate-session.ts. Replaces Slice 10's 2-hour placeholder now that
// the policy has actually been decided. No exam carve-out here: that
// exception belongs to a candidate's sitting, never a staff session.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function sessionSecret() {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret) throw new Error("STAFF_SESSION_SECRET is not set");
  return secret;
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashStaffSessionToken(token: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Inserts the session row and returns the plaintext token — usable inside a caller-managed transaction (setStaffPassword's one-transaction activation). */
export async function createStaffSessionRecord(
  db: Db,
  staffId: string,
  opts: { userAgent: string | null; ipAddress: string | null }
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashStaffSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.session.create({
    data: { staffId, tokenHash, expiresAt, userAgent: opts.userAgent, ipAddress: opts.ipAddress },
  });
  return token;
}

export async function setStaffSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Creates the session row (outside any caller-managed transaction) and sets the cookie in one call — used by staffSignIn. */
export async function createStaffSession(staffId: string) {
  const token = await createStaffSessionRecord(prisma, staffId, {
    userAgent: await getUserAgent(),
    ipAddress: await getClientIp(),
  });
  await setStaffSessionCookie(token);
}

/** Revokes the current session row (if any) and clears the cookie. */
export async function destroyStaffSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashStaffSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(COOKIE_NAME);
}

/** Revokes every live session for a staff member — the deactivation seam (README A5 rule 6). */
export async function revokeAllStaffSessions(staffId: string, db: Db = prisma) {
  await db.session.updateMany({
    where: { staffId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface CurrentStaff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Permission[];
  /** For the client-side 15-minutes-remaining warning (README H3 rule 5). */
  sessionExpiresAt: Date;
}

/**
 * Core lookup, shared by getCurrentStaff() (cached, for Server
 * Components/Actions) and proxy.ts (runs before React's cache() would
 * apply). Returns null for: no matching session, a revoked/expired
 * session, or a SUSPENDED/DEACTIVATED account — self-healing a
 * not-yet-revoked session on a since-suspended account by revoking it
 * on read, same discipline as resolveCandidateFromToken.
 */
export async function resolveStaffFromToken(token: string): Promise<CurrentStaff | null> {
  const tokenHash = hashStaffSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { staff: { include: { permissionGrants: true } } },
  });
  if (!session || !session.staff) return null;
  if (session.revokedAt || session.expiresAt < new Date()) return null;

  const staff = session.staff;
  const inactiveStatuses: StaffStatus[] = ["SUSPENDED", "DEACTIVATED"];
  if (inactiveStatuses.includes(staff.status)) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }

  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    permissions: staff.permissionGrants.map((g) => g.permission),
    sessionExpiresAt: session.expiresAt,
  };
}

/** Request-cached lookup of the signed-in staff member, or null. Server Components/Actions read this directly. */
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveStaffFromToken(token);
});
