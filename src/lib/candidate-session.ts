import "server-only";
import { cache } from "react";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import type {
  Candidate,
  CandidateProfile,
  CandidateAccountStatus,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/**
 * Database-backed candidate sessions — deliberately NOT Auth.js / a
 * stateless JWT. Suspending an account must end live sessions
 * immediately, which a self-contained token can't do (Handoff 01
 * README). Staff/admin auth is untouched and stays on NextAuth JWT —
 * these are two independent systems by design, not an oversight.
 */

export const CANDIDATE_SESSION_COOKIE = "lavelle_candidate_session";
const COOKIE_NAME = CANDIDATE_SESSION_COOKIE;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, an absolute cap regardless of "remember me"

function sessionSecret() {
  const secret = process.env.CANDIDATE_SESSION_SECRET;
  if (!secret) throw new Error("CANDIDATE_SESSION_SECRET is not set");
  return secret;
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Inserts the session row and returns the plaintext token — split out
 * from createCandidateSession() so registerCandidate() can create it
 * inside the SAME transaction as the candidate/profile/verification-token
 * inserts (Handoff 01: "creates candidate + profile row + session +
 * verification token in one transaction"), via a transaction client.
 */
export async function createSessionRecord(
  db: Db,
  candidateId: string,
  opts: { userAgent: string | null; ipAddress: string | null }
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.session.create({
    data: { candidateId, tokenHash, expiresAt, userAgent: opts.userAgent, ipAddress: opts.ipAddress },
  });
  return token;
}

/**
 * Sets the session cookie. `remember` only controls whether the cookie
 * survives the browser closing (maxAge vs a session cookie) — the
 * underlying DB session's expiry is a fixed 30-day cap either way, so
 * signing out is always driven by the DB row, not the cookie's own
 * lifetime.
 */
export async function setSessionCookie(token: string, remember: boolean) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_MAX_AGE_SECONDS } : {}),
  });
}

/** Creates the session row (outside any caller-managed transaction) and sets the cookie in one call — used by signIn. */
export async function createCandidateSession(candidateId: string, remember: boolean) {
  const token = await createSessionRecord(prisma, candidateId, {
    userAgent: await getUserAgent(),
    ipAddress: await getClientIp(),
  });
  await setSessionCookie(token, remember);
}

/** Revokes the current session row (if any) and clears the cookie. */
export async function destroyCandidateSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(COOKIE_NAME);
}

/** Revokes every live session for a candidate — the suspension seam. */
export async function revokeAllSessions(candidateId: string) {
  await prisma.session.updateMany({
    where: { candidateId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const CHECKLIST_KEYS = ["account", "professional", "photo", "email", "handbook"] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export interface CurrentCandidate {
  id: string;
  applicantNumber: string;
  candidateNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: Date | null;
  accountStatus: CandidateAccountStatus;
  isEnrolled: boolean;
  profile: CandidateProfile | null;
  checklist: Record<ChecklistKey, boolean> & { doneCount: number; allDone: boolean };
}

function computeChecklist(
  candidate: Pick<Candidate, "emailVerifiedAt">,
  profile: CandidateProfile | null
): CurrentCandidate["checklist"] {
  const items: Record<ChecklistKey, boolean> = {
    account: true,
    professional: !!profile?.completedAt,
    photo: !!profile?.photoUrl,
    email: !!candidate.emailVerifiedAt,
    handbook: !!profile?.handbookAcknowledgedAt,
  };
  const doneCount = CHECKLIST_KEYS.filter((k) => items[k]).length;
  return { ...items, doneCount, allDone: doneCount === CHECKLIST_KEYS.length };
}

/**
 * Core lookup, shared by getCurrentCandidate() (React-cache wrapped, for
 * Server Components/Actions) and proxy.ts (which runs before any React
 * render even starts, so React's cache() doesn't apply there — it calls
 * this directly instead). Returns null for: no matching session, a
 * revoked/expired session, or a suspended account — the last two collapse
 * to the same "signed out" outcome, self-healing a suspended-but-not-yet-
 * revoked session by revoking it on read.
 */
export async function resolveCandidateFromToken(token: string): Promise<CurrentCandidate | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { candidate: { include: { profile: true } } },
  });
  if (!session || !session.candidate) return null;
  if (session.revokedAt || session.expiresAt < new Date()) return null;

  const candidate = session.candidate;
  if (candidate.accountStatus === "SUSPENDED") {
    // Belt-and-braces: a suspension should already have revoked this row;
    // if it somehow didn't, revoke it now rather than honouring it.
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }

  return {
    id: candidate.id,
    applicantNumber: candidate.applicantNumber,
    candidateNumber: candidate.candidateNumber,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    emailVerifiedAt: candidate.emailVerifiedAt,
    accountStatus: candidate.accountStatus,
    isEnrolled: candidate.candidateNumber !== null,
    profile: candidate.profile,
    checklist: computeChecklist(candidate, candidate.profile),
  };
}

/**
 * Request-cached lookup of the signed-in candidate. Server Components
 * read this directly instead of fetching /api/me from the client
 * (Handoff 01 README, rule 12).
 */
export const getCurrentCandidate = cache(async (): Promise<CurrentCandidate | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveCandidateFromToken(token);
});

/**
 * Layer 2 of the applicant gate, for use at the top of a gated route
 * segment's page.tsx (Handoff 01 rule 5: "the route segment's Server
 * Component re-checks — middleware alone is not an authorisation
 * boundary"). Redirects rather than throwing, since a page render isn't
 * the place for requireEnrolled()'s typed error.
 */
export async function requireEnrolledPage(): Promise<CurrentCandidate> {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");
  if (!candidate.isEnrolled) redirect("/portal/dashboard");
  return candidate;
}

export class NotEnrolledError extends Error {
  constructor() {
    super("This action requires a confirmed enrolment.");
    this.name = "NotEnrolledError";
  }
}

/**
 * Layer 3 of the applicant gate (Handoff 01 rule 5): every Server Action
 * or route handler that reads programme content, deadlines, assessments
 * or examinations must call this before doing any gated work — hiding
 * nav items and redirecting the route are courtesies, not enforcement.
 * No gated data exists yet in this slice; this is the seam later slices
 * call into.
 */
export function requireEnrolled(candidate: CurrentCandidate | null): asserts candidate is CurrentCandidate & { isEnrolled: true } {
  if (!candidate || !candidate.isEnrolled) throw new NotEnrolledError();
}
