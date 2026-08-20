import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { hashPassword } from "@/lib/password";
import { hashStaffSessionToken, createStaffSessionRecord, resolveStaffFromToken, revokeAllStaffSessions } from "@/lib/staff-session";
import { hashSessionToken, createSessionRecord, resolveCandidateFromToken } from "@/lib/candidate-session";
import {
  staffSignInCore,
  setStaffPasswordCore,
  resendStaffInvitationCore,
  GENERIC_SIGNIN_ERROR,
  LOCKOUT_MESSAGE,
} from "@/lib/staff-auth-actions";
import { createInvitationTokenRecord, previewInvitationToken, consumeInvitationToken } from "@/lib/staff-invitation";
import { deactivateStaff } from "@/lib/rbac";
import { resolveRequest, assignRequest, NotAssigneeOrAssignerError } from "@/lib/support";

const DEMO_PASSWORD = "Correct-Horse-9";

async function makeStaff(status: "ACTIVE" | "INVITED" | "SUSPENDED" | "DEACTIVATED", opts: { withPassword?: boolean } = {}) {
  const withPassword = opts.withPassword ?? status === "ACTIVE";
  return testPrisma.staff.create({
    data: {
      name: "Test Staff",
      email: `staff-access-test-${crypto.randomUUID()}@example.com`,
      role: "SUPPORT",
      status,
      passwordHash: withPassword ? await hashPassword(DEMO_PASSWORD) : null,
    },
  });
}

async function cleanupStaff(...ids: string[]) {
  await testPrisma.session.deleteMany({ where: { staffId: { in: ids } } });
  await testPrisma.staffInvitationToken.deleteMany({ where: { OR: [{ staffId: { in: ids } }, { invitedByStaffId: { in: ids } }] } });
  await testPrisma.staffPermission.deleteMany({ where: { OR: [{ staffId: { in: ids } }, { grantedByStaffId: { in: ids } }] } });
  for (const id of ids) await testPrisma.staff.updateMany({ where: { invitedByStaffId: id }, data: { invitedByStaffId: null } });
  for (const id of ids) await testPrisma.staff.delete({ where: { id } }).catch(() => {});
}

// Sweep stray rows from earlier interrupted runs before asserting on
// rate-limit bucket state (same discipline as tests/permissions.test.ts).
beforeAll(async () => {
  const stray = await testPrisma.staff.findMany({ where: { email: { startsWith: "staff-access-test-" } }, select: { id: true } });
  if (stray.length > 0) await cleanupStaff(...stray.map((s) => s.id));

  const strayCandidates = await testPrisma.candidate.findMany({
    where: { firstName: "Session", lastName: "Independence" },
    select: { id: true },
  });
  if (strayCandidates.length > 0) {
    await testPrisma.session.deleteMany({ where: { candidateId: { in: strayCandidates.map((c) => c.id) } } });
    await testPrisma.candidate.deleteMany({ where: { id: { in: strayCandidates.map((c) => c.id) } } });
  }
});

describe("staffSignInCore — the five failure cases are indistinguishable (README A5 rule 1)", () => {
  it("wrong password, unknown address, invited, suspended and deactivated all return the exact same message", async () => {
    const active = await makeStaff("ACTIVE");
    const invited = await makeStaff("INVITED");
    const suspended = await makeStaff("SUSPENDED");
    const deactivated = await makeStaff("DEACTIVATED");

    const ip = () => `203.0.113.${crypto.randomInt(2, 254)}`;

    const wrongPassword = await staffSignInCore(active.email, "not-the-real-password", ip(), null);
    const unknownAddress = await staffSignInCore(`nope-${crypto.randomUUID()}@example.com`, DEMO_PASSWORD, ip(), null);
    const invitedNotActivated = await staffSignInCore(invited.email, DEMO_PASSWORD, ip(), null);
    const suspendedResult = await staffSignInCore(suspended.email, DEMO_PASSWORD, ip(), null);
    const deactivatedResult = await staffSignInCore(deactivated.email, DEMO_PASSWORD, ip(), null);

    for (const result of [wrongPassword, unknownAddress, invitedNotActivated, suspendedResult, deactivatedResult]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(GENERIC_SIGNIN_ERROR);
    }

    await cleanupStaff(active.id, invited.id, suspended.id, deactivated.id);
  });

  it("a correct email and password for an ACTIVE account succeeds and creates a real session", async () => {
    const active = await makeStaff("ACTIVE");
    const result = await staffSignInCore(active.email, DEMO_PASSWORD, "203.0.113.9", "test-agent");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const resolved = await resolveStaffFromToken(result.sessionToken);
      expect(resolved?.id).toBe(active.id);
    }
    await cleanupStaff(active.id);
  });

  it("locks the account after five failures within the window and writes an audit event, without ever revealing whether the address is real", async () => {
    const active = await makeStaff("ACTIVE");
    const email = active.email;

    let sawLockout = false;
    for (let i = 0; i < 8; i++) {
      const result = await staffSignInCore(email, "still-wrong", `203.0.113.${crypto.randomInt(2, 254)}`, null);
      expect(result.ok).toBe(false);
      if (!result.ok && result.message === LOCKOUT_MESSAGE) {
        sawLockout = true;
        break;
      }
    }
    expect(sawLockout).toBe(true);

    const lockoutEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "staff", subjectId: active.id, action: "staff.signin.locked" },
    });
    expect(lockoutEvent).not.toBeNull();

    // Even once locked, a legitimate correct password gets the same lockout message — not a hint that credentials would otherwise work.
    const stillLocked = await staffSignInCore(email, DEMO_PASSWORD, "203.0.113.200", null);
    expect(stillLocked.ok).toBe(false);
    if (!stillLocked.ok) expect(stillLocked.message).toBe(LOCKOUT_MESSAGE);

    await cleanupStaff(active.id);
  });
});

describe("invitation tokens — hashed, single use, 48-hour expiry (README A2)", () => {
  it("a token can be consumed exactly once — reuse fails", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const token = await createInvitationTokenRecord(testPrisma, invited.id, inviter.id);

    expect(await previewInvitationToken(token)).not.toBeNull();

    const result = await testPrisma.$transaction((tx) => consumeInvitationToken(tx, token));
    expect(result?.staffId).toBe(invited.id);

    // Second use of the exact same token: gone, not re-usable.
    expect(await previewInvitationToken(token)).toBeNull();
    const secondAttempt = await testPrisma.$transaction((tx) => consumeInvitationToken(tx, token));
    expect(secondAttempt).toBeNull();

    await cleanupStaff(invited.id, inviter.id);
  });

  it("an expired token is treated as invalid, not consumed", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await testPrisma.staffInvitationToken.create({
      data: { staffId: invited.id, invitedByStaffId: inviter.id, tokenHash, expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await previewInvitationToken(token)).toBeNull();
    const result = await testPrisma.$transaction((tx) => consumeInvitationToken(tx, token));
    expect(result).toBeNull();

    await cleanupStaff(invited.id, inviter.id);
  });

  it("resending invalidates every outstanding token first — two live links for one account never coexist", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const firstToken = await createInvitationTokenRecord(testPrisma, invited.id, inviter.id);
    expect(await previewInvitationToken(firstToken)).not.toBeNull();

    await resendStaffInvitationCore(invited.id, inviter.id);

    // The original link no longer works...
    expect(await previewInvitationToken(firstToken)).toBeNull();
    // ...but exactly one fresh, live token now exists for the account.
    const live = await testPrisma.staffInvitationToken.findMany({ where: { staffId: invited.id, consumedAt: null } });
    expect(live).toHaveLength(1);

    await cleanupStaff(invited.id, inviter.id);
  });
});

describe("setStaffPasswordCore — activation is one transaction (README A5 rule 3)", () => {
  it("a valid token sets the password, activates the account, consumes the token and creates a session together", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const token = await createInvitationTokenRecord(testPrisma, invited.id, inviter.id);

    const result = await setStaffPasswordCore(token, "Br4nd-New-Pw!", "203.0.113.50", "test-agent");
    expect(result.ok).toBe(true);

    const after = await testPrisma.staff.findUniqueOrThrow({ where: { id: invited.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.passwordHash).not.toBeNull();
    expect(after.activatedAt).not.toBeNull();

    const tokenRow = await testPrisma.staffInvitationToken.findFirst({ where: { staffId: invited.id } });
    expect(tokenRow?.consumedAt).not.toBeNull();

    if (result.ok) {
      const resolved = await resolveStaffFromToken(result.sessionToken);
      expect(resolved?.id).toBe(invited.id);
    }

    const activatedEvent = await testPrisma.auditEvent.findFirst({ where: { subjectType: "staff", subjectId: invited.id, action: "staff.activated" } });
    expect(activatedEvent).not.toBeNull();

    await cleanupStaff(invited.id, inviter.id);
  });

  it("an expired or already-used token changes nothing — no password set, no status change, no session created", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await testPrisma.staffInvitationToken.create({
      data: { staffId: invited.id, invitedByStaffId: inviter.id, tokenHash, expiresAt: new Date(Date.now() - 60_000) },
    });

    const before = await testPrisma.staff.findUniqueOrThrow({ where: { id: invited.id } });
    const result = await setStaffPasswordCore(token, "Br4nd-New-Pw!", "203.0.113.51", "test-agent");
    expect(result.ok).toBe(false);

    const after = await testPrisma.staff.findUniqueOrThrow({ where: { id: invited.id } });
    expect(after.status).toBe(before.status);
    expect(after.passwordHash).toBeNull();
    expect(after.activatedAt).toBeNull();

    const sessions = await testPrisma.session.count({ where: { staffId: invited.id } });
    expect(sessions).toBe(0);

    await cleanupStaff(invited.id, inviter.id);
  });

  it("a token whose account was suspended after issuing it no longer activates the account", async () => {
    const invited = await makeStaff("INVITED");
    const inviter = await makeStaff("ACTIVE");
    const token = await createInvitationTokenRecord(testPrisma, invited.id, inviter.id);
    await testPrisma.staff.update({ where: { id: invited.id }, data: { status: "SUSPENDED" } });

    const result = await setStaffPasswordCore(token, "Br4nd-New-Pw!", "203.0.113.52", "test-agent");
    expect(result.ok).toBe(false);

    const after = await testPrisma.staff.findUniqueOrThrow({ where: { id: invited.id } });
    expect(after.status).toBe("SUSPENDED");
    expect(after.passwordHash).toBeNull();

    await cleanupStaff(invited.id, inviter.id);
  });
});

describe("staff-session revocation on deactivation (README A5 rule 6)", () => {
  it("deactivating a staff member revokes their live sessions immediately", async () => {
    const active = await makeStaff("ACTIVE");
    const registrar = await makeStaff("ACTIVE"); // acting super-admin-equivalent for this test — role doesn't matter to deactivateStaff itself
    const token = await createStaffSessionRecord(testPrisma, active.id, { userAgent: null, ipAddress: null });

    expect((await resolveStaffFromToken(token))?.id).toBe(active.id);

    await deactivateStaff({ staffId: active.id, reason: "Left the institution", actingStaffId: registrar.id });

    expect(await resolveStaffFromToken(token)).toBeNull();
    const session = await testPrisma.session.findUniqueOrThrow({ where: { tokenHash: hashStaffSessionToken(token) } });
    expect(session.revokedAt).not.toBeNull();

    await cleanupStaff(active.id, registrar.id);
  });
});

describe("candidate and staff sessions revoke independently (README A1)", () => {
  let candidateId: string;
  let staffId: string;

  beforeAll(async () => {
    const rows = await testPrisma.$queryRaw<{ next_applicant_number: string }[]>`SELECT next_applicant_number()`;
    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: rows[0]!.next_applicant_number,
        firstName: "Session",
        lastName: "Independence",
        email: `staff-access-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    candidateId = candidate.id;
    const staff = await makeStaff("ACTIVE");
    staffId = staff.id;
  });

  afterAll(async () => {
    await testPrisma.session.deleteMany({ where: { OR: [{ candidateId }, { staffId }] } });
    await testPrisma.candidate.delete({ where: { id: candidateId } }).catch(() => {});
    await cleanupStaff(staffId);
  });

  it("signing out the candidate session leaves a live staff session on the same machine untouched, and vice versa", async () => {
    const candidateToken = await createSessionRecord(testPrisma, candidateId, { userAgent: null, ipAddress: null });
    const staffToken = await createStaffSessionRecord(testPrisma, staffId, { userAgent: null, ipAddress: null });

    expect((await resolveCandidateFromToken(candidateToken))?.id).toBe(candidateId);
    expect((await resolveStaffFromToken(staffToken))?.id).toBe(staffId);

    // Revoke only the candidate session (the candidate "signing out").
    await testPrisma.session.updateMany({ where: { tokenHash: hashSessionToken(candidateToken) }, data: { revokedAt: new Date() } });

    expect(await resolveCandidateFromToken(candidateToken)).toBeNull();
    // The staff session on the same machine is completely unaffected.
    expect((await resolveStaffFromToken(staffToken))?.id).toBe(staffId);

    // Symmetrically: revoking every staff session never touches the candidate's.
    const candidateToken2 = await createSessionRecord(testPrisma, candidateId, { userAgent: null, ipAddress: null });
    await revokeAllStaffSessions(staffId);
    expect((await resolveCandidateFromToken(candidateToken2))?.id).toBe(candidateId);
  });
});

describe("support request resolution — the two-key rule refuses a third agent (README B3/B5 rule 2)", () => {
  it("neither a bystander staff member nor a direct call bypasses the rule; the assignee, the assigner, and manage_staff all succeed", async () => {
    const assignee = await makeStaff("ACTIVE");
    const assigner = await makeStaff("ACTIVE");
    const bystander = await makeStaff("ACTIVE");
    const superAdmin = await makeStaff("ACTIVE");

    const requestA = await testPrisma.supportRequest.create({
      data: { guestName: "Test Enquirer", guestEmail: "enquirer@example.com", subject: "Test A", category: "OTHER", body: "..." },
    });
    await assignRequest({ requestId: requestA.id, staffId: assignee.id, priority: "NORMAL" as never }, assigner.id);

    // A third agent, holding no special relationship to this request and no manage_staff, is refused — even calling the function directly.
    await expect(resolveRequest(requestA.id, bystander.id, false)).rejects.toThrow(NotAssigneeOrAssignerError);
    const stillOpen = await testPrisma.supportRequest.findUniqueOrThrow({ where: { id: requestA.id } });
    expect(stillOpen.status).not.toBe("RESOLVED");

    // The assignee may resolve it.
    await resolveRequest(requestA.id, assignee.id, false);
    const resolvedByAssignee = await testPrisma.supportRequest.findUniqueOrThrow({ where: { id: requestA.id } });
    expect(resolvedByAssignee.status).toBe("RESOLVED");
    expect(resolvedByAssignee.resolvedByStaffId).toBe(assignee.id);

    // A second request: the assigner (not the assignee) may also resolve it.
    const requestB = await testPrisma.supportRequest.create({
      data: { guestName: "Test Enquirer", guestEmail: "enquirer@example.com", subject: "Test B", category: "OTHER", body: "..." },
    });
    await assignRequest({ requestId: requestB.id, staffId: assignee.id, priority: "NORMAL" as never }, assigner.id);
    await resolveRequest(requestB.id, assigner.id, false);
    expect((await testPrisma.supportRequest.findUniqueOrThrow({ where: { id: requestB.id } })).status).toBe("RESOLVED");

    // A third request: a bystander with manage_staff (the escape hatch) may resolve it too.
    const requestC = await testPrisma.supportRequest.create({
      data: { guestName: "Test Enquirer", guestEmail: "enquirer@example.com", subject: "Test C", category: "OTHER", body: "..." },
    });
    await assignRequest({ requestId: requestC.id, staffId: assignee.id, priority: "NORMAL" as never }, assigner.id);
    await resolveRequest(requestC.id, superAdmin.id, true);
    expect((await testPrisma.supportRequest.findUniqueOrThrow({ where: { id: requestC.id } })).status).toBe("RESOLVED");

    await testPrisma.supportRequest.deleteMany({ where: { id: { in: [requestA.id, requestB.id, requestC.id] } } });
    await cleanupStaff(assignee.id, assigner.id, bystander.id, superAdmin.id);
  });
});
