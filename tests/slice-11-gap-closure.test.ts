import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { clearSitting, referSitting, FindingRequiredError } from "@/lib/invigilation-actions";
import { releaseResults } from "@/lib/exam-sitting-actions";
import { assertProgrammeOpenForEnrolment, ProgrammeNotOpenError } from "@/lib/payment-errors";
import { submitReview, NotCompletedError } from "@/lib/review-actions";
import { getMyRequestThread } from "@/lib/support-reads";
import { submitCandidateReply, assignRequest } from "@/lib/support";
import { suspendStaff, LastSuperAdminError } from "@/lib/rbac";
import { hashSessionToken, resolveCandidateFromToken } from "@/lib/candidate-session";

async function makeStaff(role: "SUPER_ADMIN" | "ACADEMIC_ADMIN" | "SUPPORT" = "ACADEMIC_ADMIN") {
  return testPrisma.staff.create({
    data: { name: "Test Staff", email: `s11-${crypto.randomUUID()}@example.com`, role, status: "ACTIVE", passwordHash: "not-a-real-hash" },
  });
}

async function makeCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Test",
      lastName: "Candidate",
      email: `s11-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function makeCategoryAndStaff() {
  const staff = await makeStaff();
  const category = await testPrisma.programmeCategory.create({
    data: { name: `S11 Category ${crypto.randomUUID()}`, slug: `s11-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function makeProgramme(categoryId: string, staffId: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return testPrisma.programme.create({
    data: {
      code: `S11-${crypto.randomUUID().slice(0, 8)}`,
      title: "S11 Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status,
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: 45_000_000,
      createdByStaffId: staffId,
    },
  });
}

async function makeExam(programmeId: string) {
  return testPrisma.exam.create({
    data: { programmeId, status: "PUBLISHED", durationMinutes: 120, passMarkPercent: 60, feeMinor: 8_500_000 },
  });
}

async function makeWindow(examId: string) {
  const now = Date.now();
  return testPrisma.examWindow.create({
    data: { examId, opensAt: new Date(now - 60_000), closesAt: new Date(now + 3_600_000), registrationDeadline: new Date(now + 3_600_000) },
  });
}

async function makeSubmittedSitting(candidateId: string, examId: string, windowId: string, conductReview: "PENDING" | "REFERRED" = "PENDING") {
  const registration = await testPrisma.examRegistration.create({
    data: { candidateId, examId, windowId, registeredAt: new Date() },
  });
  return testPrisma.sitting.create({
    data: {
      registrationId: registration.id,
      state: "SUBMITTED",
      startedAt: new Date(Date.now() - 3_600_000),
      submittedAt: new Date(),
      objectivePercent: 80,
      totalPercent: 80,
      conductReview,
    },
  });
}

async function cleanupProgrammeTree(categoryId: string, staffId: string, programmeId: string) {
  const exam = await testPrisma.exam.findUnique({ where: { programmeId } });
  if (exam) {
    const sittings = await testPrisma.sitting.findMany({ where: { registration: { examId: exam.id } }, select: { id: true } });
    // A PASSing releaseResults issues a certificate (Slice 07), whose
    // rendered-PDF MediaAsset RESTRICT-guards staff deletion — same
    // cleanup exam-sitting.test.ts's own cleanupRoot already needs.
    await testPrisma.certificate.deleteMany({ where: { sittingId: { in: sittings.map((s) => s.id) } } });
    await testPrisma.mediaAsset.deleteMany({ where: { uploadedByStaffId: staffId } });
    await testPrisma.proctoringEvent.deleteMany({ where: { sittingId: { in: sittings.map((s) => s.id) } } });
    await testPrisma.sitting.deleteMany({ where: { registration: { examId: exam.id } } });
    await testPrisma.examRegistration.deleteMany({ where: { examId: exam.id } });
    await testPrisma.examWindow.deleteMany({ where: { examId: exam.id } });
    await testPrisma.exam.delete({ where: { id: exam.id } });
  }
  await testPrisma.programme.delete({ where: { id: programmeId } });
  await testPrisma.programmeCategory.delete({ where: { id: categoryId } });
  await testPrisma.staff.delete({ where: { id: staffId } });
}

describe("Part B — invigilation: a finding is required before clear/refer", () => {
  const created: { categoryId: string; staffId: string; programmeId: string; candidateIds: string[] } = {
    categoryId: "",
    staffId: "",
    programmeId: "",
    candidateIds: [],
  };

  afterEach(async () => {
    await testPrisma.candidate.deleteMany({ where: { id: { in: created.candidateIds } } });
    if (created.programmeId) await cleanupProgrammeTree(created.categoryId, created.staffId, created.programmeId);
    created.candidateIds = [];
    created.categoryId = "";
    created.staffId = "";
    created.programmeId = "";
  });

  it("refuses to clear or refer without a finding, and succeeds once one is written", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id);
    const exam = await makeExam(programme.id);
    const window = await makeWindow(exam.id);
    const candidate = await makeCandidate();
    created.categoryId = category.id;
    created.staffId = staff.id;
    created.programmeId = programme.id;
    created.candidateIds = [candidate.id];

    const sitting = await makeSubmittedSitting(candidate.id, exam.id, window.id);

    await expect(clearSitting(sitting.id, "", staff.id, null)).rejects.toThrow(FindingRequiredError);
    await expect(clearSitting(sitting.id, "   ", staff.id, null)).rejects.toThrow(FindingRequiredError);
    await expect(referSitting(sitting.id, "", staff.id, null)).rejects.toThrow(FindingRequiredError);

    const cleared = await clearSitting(sitting.id, "No pattern of concern in the log.", staff.id, null);
    expect(cleared.conductReview).toBe("CLEARED");
    expect(cleared.invigilatorFinding).toBe("No pattern of concern in the log.");
    expect(cleared.reviewedByStaffId).toBe(staff.id);
    expect(cleared.reviewedAt).not.toBeNull();
  });

  it("referring sets referredAt and excludes the sitting from releaseResults", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id);
    const exam = await makeExam(programme.id);
    const window = await makeWindow(exam.id);
    const referredCandidate = await makeCandidate();
    const cleanCandidate = await makeCandidate();
    created.categoryId = category.id;
    created.staffId = staff.id;
    created.programmeId = programme.id;
    created.candidateIds = [referredCandidate.id, cleanCandidate.id];

    const referredSitting = await makeSubmittedSitting(referredCandidate.id, exam.id, window.id);
    const cleanSitting = await makeSubmittedSitting(cleanCandidate.id, exam.id, window.id);

    const referred = await referSitting(referredSitting.id, "Four full-screen exits in the final ten minutes.", staff.id, null);
    expect(referred.conductReview).toBe("REFERRED");
    expect(referred.referredAt).not.toBeNull();

    const result = await releaseResults(window.id, staff.id, null);
    expect(result.releasedCount).toBe(1);

    const [refreshedReferred, refreshedClean] = await Promise.all([
      testPrisma.sitting.findUniqueOrThrow({ where: { id: referredSitting.id } }),
      testPrisma.sitting.findUniqueOrThrow({ where: { id: cleanSitting.id } }),
    ]);
    expect(refreshedReferred.state).toBe("SUBMITTED"); // untouched by release
    expect(refreshedClean.state).toBe("RELEASED");
  });
});

describe("Part C — initiatePayment refuses an archived programme", () => {
  it("assertProgrammeOpenForEnrolment throws for ARCHIVED and DRAFT, passes for ACTIVE", () => {
    expect(() => assertProgrammeOpenForEnrolment({ status: "ARCHIVED" })).toThrow(ProgrammeNotOpenError);
    expect(() => assertProgrammeOpenForEnrolment({ status: "DRAFT" })).toThrow(ProgrammeNotOpenError);
    expect(() => assertProgrammeOpenForEnrolment({ status: "ACTIVE" })).not.toThrow();
  });

  it("refuses against a real archived programme row, not just a shaped object", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id, "ARCHIVED");
    const reloaded = await testPrisma.programme.findUniqueOrThrow({ where: { id: programme.id } });
    expect(() => assertProgrammeOpenForEnrolment(reloaded)).toThrow(ProgrammeNotOpenError);
    await testPrisma.programme.delete({ where: { id: programme.id } });
    await testPrisma.programmeCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } });
  });
});

describe("Part D — Review.isPublished -> state migration", () => {
  it("the isPublished column no longer exists; state carries the three values", async () => {
    const cols = await testPrisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Review' AND column_name IN ('isPublished', 'state')
    `;
    const names = cols.map((c) => c.column_name);
    expect(names).not.toContain("isPublished");
    expect(names).toContain("state");
  });

  it("existing published reviews (seeded before this migration) carry state = PUBLISHED", async () => {
    const published = await testPrisma.review.findFirst({ where: { authorName: "Adaeze Okonkwo" } });
    expect(published?.state).toBe("PUBLISHED");
  });
});

describe("Part D — review submission is gated on a COMPLETED enrolment", () => {
  const created: { categoryId: string; staffId: string; programmeId: string; candidateId: string; enrolmentId: string; intakeId: string } = {
    categoryId: "",
    staffId: "",
    programmeId: "",
    candidateId: "",
    enrolmentId: "",
    intakeId: "",
  };

  afterEach(async () => {
    await testPrisma.review.deleteMany({ where: { candidateId: created.candidateId } });
    if (created.enrolmentId) await testPrisma.enrolment.delete({ where: { id: created.enrolmentId } }).catch(() => {});
    if (created.candidateId) await testPrisma.candidate.delete({ where: { id: created.candidateId } }).catch(() => {});
    if (created.intakeId) await testPrisma.intake.delete({ where: { id: created.intakeId } }).catch(() => {});
    if (created.programmeId) await testPrisma.programme.delete({ where: { id: created.programmeId } }).catch(() => {});
    if (created.categoryId) await testPrisma.programmeCategory.delete({ where: { id: created.categoryId } }).catch(() => {});
    if (created.staffId) await testPrisma.staff.delete({ where: { id: created.staffId } }).catch(() => {});
  });

  it("refuses when the enrolment is not COMPLETED, succeeds once it is", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id);
    const candidate = await makeCandidate();
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const enrolment = await testPrisma.enrolment.create({
      data: { candidateId: candidate.id, programmeId: programme.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });
    created.categoryId = category.id;
    created.staffId = staff.id;
    created.programmeId = programme.id;
    created.candidateId = candidate.id;
    created.enrolmentId = enrolment.id;
    created.intakeId = intake.id;

    await expect(
      submitReview({ candidateId: candidate.id, enrolmentId: enrolment.id, rating: 5, quote: "Excellent programme." })
    ).rejects.toThrow(NotCompletedError);

    await testPrisma.enrolment.update({ where: { id: enrolment.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    const review = await submitReview({ candidateId: candidate.id, enrolmentId: enrolment.id, rating: 5, quote: "Excellent programme." });
    expect(review.state).toBe("PENDING");
    expect(review.candidateId).toBe(candidate.id);
  });
});

describe("Part F — candidate support threads: scoping and reopen", () => {
  const candidateIds: string[] = [];
  const staffIds: string[] = [];
  const requestIds: string[] = [];

  afterEach(async () => {
    await testPrisma.notification.deleteMany({ where: { staffId: { in: staffIds } } });
    await testPrisma.supportMessage.deleteMany({ where: { requestId: { in: requestIds } } });
    await testPrisma.supportRequest.deleteMany({ where: { id: { in: requestIds } } });
    await testPrisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
    await testPrisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    candidateIds.length = 0;
    staffIds.length = 0;
    requestIds.length = 0;
  });

  it("a candidate cannot read another candidate's thread by id alone", async () => {
    const owner = await makeCandidate();
    const stranger = await makeCandidate();
    candidateIds.push(owner.id, stranger.id);
    const request = await testPrisma.supportRequest.create({
      data: { candidateId: owner.id, subject: "Payment issue", category: "PAYMENT", body: "My card was declined twice." },
    });
    requestIds.push(request.id);

    expect(await getMyRequestThread(request.id, owner.id)).not.toBeNull();
    expect(await getMyRequestThread(request.id, stranger.id)).toBeNull();
  });

  it("a reply to a resolved request reopens it and notifies whoever closed it", async () => {
    const candidate = await makeCandidate();
    const assignee = await makeStaff("SUPPORT");
    candidateIds.push(candidate.id);
    staffIds.push(assignee.id);

    const request = await testPrisma.supportRequest.create({
      data: { candidateId: candidate.id, subject: "Enrolment question", category: "ENROLMENT", body: "When does my cohort start?" },
    });
    requestIds.push(request.id);

    await assignRequest({ requestId: request.id, staffId: assignee.id, priority: "NORMAL" }, assignee.id);
    await testPrisma.supportRequest.update({
      where: { id: request.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByStaffId: assignee.id },
    });

    await submitCandidateReply(request.id, candidate.id, "This isn't actually resolved — still no start date.");

    const reopened = await testPrisma.supportRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(reopened.status).toBe("IN_PROGRESS"); // has an assignee, so IN_PROGRESS not OPEN
    expect(reopened.resolvedAt).toBeNull();

    const notification = await testPrisma.notification.findFirst({
      where: { staffId: assignee.id, title: { contains: "reopened" } },
      orderBy: { createdAt: "desc" },
    });
    expect(notification).not.toBeNull();
  });

  it("submitCandidateReply refuses a request that isn't the caller's own", async () => {
    const owner = await makeCandidate();
    const stranger = await makeCandidate();
    candidateIds.push(owner.id, stranger.id);
    const request = await testPrisma.supportRequest.create({
      data: { candidateId: owner.id, subject: "Technical access", category: "TECHNICAL", body: "Can't load a lecture." },
    });
    requestIds.push(request.id);

    await expect(submitCandidateReply(request.id, stranger.id, "Let me in on this too.")).rejects.toThrow();
  });
});

describe("Part G — the last-active-super-admin guard applies to suspension exactly as deactivation", () => {
  const created: string[] = [];
  let temporarilySuspended: string[] = [];

  beforeAll(async () => {
    const others = await testPrisma.staff.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } });
    temporarilySuspended = others.map((s) => s.id);
    if (temporarilySuspended.length > 0) {
      await testPrisma.staff.updateMany({ where: { id: { in: temporarilySuspended } }, data: { status: "SUSPENDED" } });
    }
  });

  afterAll(async () => {
    if (temporarilySuspended.length > 0) {
      await testPrisma.staff.updateMany({ where: { id: { in: temporarilySuspended } }, data: { status: "ACTIVE" } });
    }
  });

  afterEach(async () => {
    await testPrisma.staff.deleteMany({ where: { id: { in: created } } });
    created.length = 0;
  });

  it("blocks suspending the sole active super admin", async () => {
    const solo = await makeStaff("SUPER_ADMIN");
    const acting = await makeStaff("ACADEMIC_ADMIN");
    created.push(solo.id, acting.id);
    await expect(suspendStaff({ staffId: solo.id, reason: "test", actingStaffId: acting.id })).rejects.toThrow(LastSuperAdminError);
  });

  it("requires a reason even when the guard would otherwise pass", async () => {
    const a = await makeStaff("SUPER_ADMIN");
    const b = await makeStaff("SUPER_ADMIN");
    created.push(a.id, b.id);
    await expect(suspendStaff({ staffId: a.id, reason: "  ", actingStaffId: b.id })).rejects.toThrow();
  });

  it(
    "under two CONCURRENT suspension attempts against the two active super admins, at least one is refused",
    async () => {
      const a = await makeStaff("SUPER_ADMIN");
      const b = await makeStaff("SUPER_ADMIN");
      created.push(a.id, b.id);

      const results = await Promise.allSettled([
        suspendStaff({ staffId: a.id, reason: "concurrent test", actingStaffId: b.id }),
        suspendStaff({ staffId: b.id, reason: "concurrent test", actingStaffId: a.id }),
      ]);

      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBeGreaterThanOrEqual(1);

      const [refreshedA, refreshedB] = await Promise.all([
        testPrisma.staff.findUniqueOrThrow({ where: { id: a.id } }),
        testPrisma.staff.findUniqueOrThrow({ where: { id: b.id } }),
      ]);
      const stillActiveSuperAdmins = [refreshedA, refreshedB].filter((s) => s.status === "ACTIVE" && s.role === "SUPER_ADMIN");
      expect(stillActiveSuperAdmins.length).toBeGreaterThanOrEqual(1);
    },
    15_000
  );
});

describe("Part H — session policy: expiresAt does not slide, and the exam carve-out extends exactly once", () => {
  let candidateId: string;

  beforeAll(async () => {
    const candidate = await makeCandidate();
    candidateId = candidate.id;
  });

  afterAll(async () => {
    await testPrisma.candidate.delete({ where: { id: candidateId } });
  });

  it("an ordinary read never changes expiresAt (rule 1: no rolling renewal)", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    const originalExpiry = new Date(Date.now() + 60_000);
    const session = await testPrisma.session.create({
      data: { candidateId, tokenHash: hashSessionToken(token), expiresAt: originalExpiry },
    });

    await resolveCandidateFromToken(token);
    await resolveCandidateFromToken(token);
    await resolveCandidateFromToken(token);

    const reloaded = await testPrisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(reloaded.expiresAt.getTime()).toBe(originalExpiry.getTime());
  });

  it("the exam carve-out extends a session past expiry exactly once, and only while an IN_PROGRESS sitting with a future expiresAt exists", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id);
    const exam = await makeExam(programme.id);
    const window = await makeWindow(exam.id);
    const registration = await testPrisma.examRegistration.create({
      data: { candidateId, examId: exam.id, windowId: window.id, registeredAt: new Date() },
    });
    const sittingExpiresAt = new Date(Date.now() + 20 * 60_000); // 20 minutes still to run
    const sitting = await testPrisma.sitting.create({
      data: { registrationId: registration.id, state: "IN_PROGRESS", startedAt: new Date(), expiresAt: sittingExpiresAt },
    });

    const token = crypto.randomBytes(32).toString("base64url");
    const session = await testPrisma.session.create({
      data: { candidateId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() - 1000) }, // already past
    });

    const resolved = await resolveCandidateFromToken(token);
    expect(resolved).not.toBeNull(); // held open by the carve-out, not signed out

    const extended = await testPrisma.session.findUniqueOrThrow({ where: { id: session.id } });
    const expectedExtension = new Date(sittingExpiresAt.getTime() + 10 * 60_000);
    expect(extended.expiresAt.getTime()).toBe(expectedExtension.getTime());

    // A second read, still within the extended window and still IN_PROGRESS,
    // must NOT extend it again — expiresAt is already past the sitting's
    // own boundary, so the "once" gate (session.expiresAt < sitting.expiresAt) is false.
    await resolveCandidateFromToken(token);
    const afterSecondRead = await testPrisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(afterSecondRead.expiresAt.getTime()).toBe(expectedExtension.getTime());

    await testPrisma.sitting.delete({ where: { id: sitting.id } });
    await testPrisma.examRegistration.delete({ where: { id: registration.id } });
    await cleanupProgrammeTree(category.id, staff.id, programme.id);
  });

  it("cannot be triggered by anything other than an IN_PROGRESS sitting — a SUBMITTED sitting with a future expiresAt does not hold the session open", async () => {
    const { staff, category } = await makeCategoryAndStaff();
    const programme = await makeProgramme(category.id, staff.id);
    const exam = await makeExam(programme.id);
    const window = await makeWindow(exam.id);
    const registration = await testPrisma.examRegistration.create({
      data: { candidateId, examId: exam.id, windowId: window.id, registeredAt: new Date() },
    });
    // SUBMITTED, not IN_PROGRESS — expiresAt is still technically in the
    // future on the row, but the carve-out only ever looks at IN_PROGRESS.
    const sitting = await testPrisma.sitting.create({
      data: { registrationId: registration.id, state: "SUBMITTED", startedAt: new Date(), expiresAt: new Date(Date.now() + 20 * 60_000), submittedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("base64url");
    await testPrisma.session.create({
      data: { candidateId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await resolveCandidateFromToken(token)).toBeNull();

    await testPrisma.sitting.delete({ where: { id: sitting.id } });
    await testPrisma.examRegistration.delete({ where: { id: registration.id } });
    await cleanupProgrammeTree(category.id, staff.id, programme.id);
  });
});
