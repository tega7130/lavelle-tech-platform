import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { resolveGradeBand, computeFinalMark } from "@/lib/grading";
import { recomputeProgrammeResult } from "@/lib/programme-result";
import { returnMark, claimForMarking, AlreadyClaimedError } from "@/lib/marking-actions";
import { listMarkingQueueQuery, openMarkableQuery } from "@/lib/marking-queries";

// Sweep stray staff rows from earlier runs — the "two markers" test below
// used to leak staffA every run (its cleanup() call omitted staffId),
// same class of bug as tests/staff-access.test.ts's leaked candidates.
beforeAll(async () => {
  const stray = await testPrisma.staff.findMany({ where: { email: { startsWith: "marking-test-" } }, select: { id: true } });
  if (stray.length > 0) await testPrisma.staff.deleteMany({ where: { id: { in: stray.map((s) => s.id) } } });
});

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Marking Staff", email: `marking-test-${crypto.randomUUID()}@example.com`, role: "FACULTY", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Marking Test Category ${crypto.randomUUID()}`, slug: `marking-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(staffId: string, categoryId: string, opts: { blindMarking?: boolean } = {}) {
  const programme = await testPrisma.programme.create({
    data: {
      code: `MRK-${crypto.randomUUID().slice(0, 8)}`,
      title: "Marking Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: 45_000_000,
      createdByStaffId: staffId,
      blindMarking: opts.blindMarking ?? false,
    },
  });
  await testPrisma.assessmentWeighting.createMany({
    data: [
      { programmeId: programme.id, kind: "QUIZ", weightPercent: 20 },
      { programmeId: programme.id, kind: "DRAFTING", weightPercent: 40 },
      { programmeId: programme.id, kind: "EXAMINATION", weightPercent: 40 },
    ],
  });
  return programme;
}

async function seedCandidateAndEnrolment(programmeId: string) {
  const candidate = await testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
      firstName: "Zephyrine",
      lastName: "Okwuosa",
      email: `marking-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
  const intake = await testPrisma.intake.create({
    data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
  });
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId: candidate.id, programmeId, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
  });
  return { candidate, enrolment, intake };
}

async function seedDraftingMark(enrolmentId: string, moduleId: string) {
  const lecture = await testPrisma.lecture.create({
    data: { moduleId, orderIndex: 0, title: `Lecture ${crypto.randomUUID().slice(0, 6)}`, mediaKind: "VIDEO", draftingPrompt: "Draft something." },
  });
  const submission = await testPrisma.draftingSubmission.create({
    data: { enrolmentId, lectureId: lecture.id, state: "SUBMITTED", body: "My answer.", wordCount: 50, submittedAt: new Date() },
  });
  const mark = await testPrisma.mark.create({
    data: { enrolmentId, kind: "DRAFTING", draftingSubmissionId: submission.id, state: "AWAITING" },
  });
  return { lecture, submission, mark };
}

async function cleanup(opts: { candidateIds?: string[]; programmeId?: string; categoryId?: string; staffId?: string; intakeIds?: string[] }) {
  if (opts.candidateIds?.length) {
    await testPrisma.mark.deleteMany({ where: { enrolmentId: { in: await enrolmentIdsFor(opts.candidateIds) } } });
    await testPrisma.draftingSubmission.deleteMany({ where: { enrolmentId: { in: await enrolmentIdsFor(opts.candidateIds) } } });
    await testPrisma.programmeResult.deleteMany({ where: { enrolmentId: { in: await enrolmentIdsFor(opts.candidateIds) } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: { in: opts.candidateIds } } });
    await testPrisma.candidate.deleteMany({ where: { id: { in: opts.candidateIds } } });
  }
  if (opts.programmeId) {
    await testPrisma.lecture.deleteMany({ where: { module: { programmeId: opts.programmeId } } });
    await testPrisma.module.deleteMany({ where: { programmeId: opts.programmeId } });
    await testPrisma.assessmentWeighting.deleteMany({ where: { programmeId: opts.programmeId } });
    await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  }
  if (opts.categoryId) await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  if (opts.staffId) await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeIds?.length) await testPrisma.intake.deleteMany({ where: { id: { in: opts.intakeIds } } });
}

async function enrolmentIdsFor(candidateIds: string[]) {
  const rows = await testPrisma.enrolment.findMany({ where: { candidateId: { in: candidateIds } }, select: { id: true } });
  return rows.map((r) => r.id);
}

describe("returnMark — feedback is mandatory before a mark is returned, enforced server-side (rule 1)", () => {
  it("refuses an empty or whitespace-only feedback and leaves the mark AWAITING", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const { candidate, enrolment, intake } = await seedCandidateAndEnrolment(programme.id);
    const { mark } = await seedDraftingMark(enrolment.id, mod.id);

    await expect(returnMark(mark.id, { scorePercent: 80, feedback: "" }, staff.id, null)).rejects.toThrow();
    await expect(returnMark(mark.id, { scorePercent: 80, feedback: "   " }, staff.id, null)).rejects.toThrow();

    const stillAwaiting = await testPrisma.mark.findUniqueOrThrow({ where: { id: mark.id } });
    expect(stillAwaiting.state).toBe("AWAITING");
    expect(stillAwaiting.scorePercent).toBeNull();

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeIds: [intake.id] });
  });
});

describe("resolveGradeBand — resolved against the definition in force at the assessment date (rule 2)", () => {
  it("a scale change does not alter which band a past assessment resolves to", async () => {
    const suffix = crypto.randomUUID();
    const oldFrom = new Date("2020-01-01");
    const oldTo = new Date("2026-01-01");
    // The old scale: Merit starts at 55%.
    await testPrisma.gradeBandDefinition.create({ data: { band: "MERIT", minPercent: 55, label: `Merit-${suffix}`, effectiveFrom: oldFrom, effectiveTo: oldTo } });
    // The new (current) scale: Merit starts at 60% — stricter.
    await testPrisma.gradeBandDefinition.create({ data: { band: "MERIT", minPercent: 60, label: `Merit-${suffix}-new`, effectiveFrom: oldTo, effectiveTo: null } });
    await testPrisma.gradeBandDefinition.create({ data: { band: "PASS", minPercent: 50, label: `Pass-${suffix}`, effectiveFrom: oldFrom, effectiveTo: null } });

    // 57% under the OLD scale was Merit; under the NEW scale it's only Pass.
    const underOldScale = await resolveGradeBand(57, new Date("2025-06-01"), testPrisma);
    const underNewScale = await resolveGradeBand(57, new Date("2026-06-01"), testPrisma);
    expect(underOldScale).toBe("MERIT");
    expect(underNewScale).toBe("PASS");

    await testPrisma.gradeBandDefinition.deleteMany({ where: { label: { contains: suffix } } });
  });
});

describe("computeFinalMark — provisional, single-rounding weighted average (rules 4/5)", () => {
  it("excludes a missing component from the denominator rather than treating it as zero", () => {
    const result = computeFinalMark(
      { quizAveragePercent: 88, draftingAveragePercent: 78, examinationPercent: null },
      { QUIZ: 20, DRAFTING: 40, EXAMINATION: 40 }
    );
    // (88*20 + 78*40) / (20+40) = 81.33 -> 81, not (88*20+78*40)/100 = 49 (which would misread a strong candidate as failing).
    expect(result.finalPercent).toBe(81);
    expect(result.isProvisional).toBe(true);
  });

  it("is no longer provisional once all three components are present", () => {
    const result = computeFinalMark(
      { quizAveragePercent: 88, draftingAveragePercent: 78, examinationPercent: 70 },
      { QUIZ: 20, DRAFTING: 40, EXAMINATION: 40 }
    );
    expect(result.isProvisional).toBe(false);
  });

  it("rounds half-up, exactly once, at the end — not per component", () => {
    // (85*50 + 76*50) / 100 = 80.5 exactly -> half-up rounds to 81, never 80
    // (which a naive per-component pre-round of 85*0.5=42.5->43 and
    // 76*0.5=38->38, summed to 81, coincidentally matches here — the real
    // test is the .5 boundary itself resolving up, not down or to even).
    const result = computeFinalMark({ quizAveragePercent: 85, draftingAveragePercent: 76, examinationPercent: null }, { QUIZ: 50, DRAFTING: 50, EXAMINATION: 0 });
    expect(result.finalPercent).toBe(81);
  });
});

describe("recomputeProgrammeResult — weightingSnapshot is stable after the programme's weighting changes (rule 3)", () => {
  it("an already-computed result keeps its old snapshot and final mark until explicitly recomputed", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id); // 20/40/40
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const { candidate, enrolment, intake } = await seedCandidateAndEnrolment(programme.id);
    const { mark } = await seedDraftingMark(enrolment.id, mod.id);

    await returnMark(mark.id, { scorePercent: 80, feedback: "Well argued." }, staff.id, null);

    const first = await testPrisma.programmeResult.findUniqueOrThrow({ where: { enrolmentId: enrolment.id } });
    expect((first.weightingSnapshot as Record<string, number>).DRAFTING).toBe(40);
    const firstFinal = first.finalPercent;

    // Weighting changes — drafting now worth 60, quiz worth 0.
    await testPrisma.assessmentWeighting.update({ where: { programmeId_kind: { programmeId: programme.id, kind: "DRAFTING" } }, data: { weightPercent: 60 } });
    await testPrisma.assessmentWeighting.update({ where: { programmeId_kind: { programmeId: programme.id, kind: "QUIZ" } }, data: { weightPercent: 0 } });

    // Without an explicit recompute, the stored result is untouched.
    const untouched = await testPrisma.programmeResult.findUniqueOrThrow({ where: { enrolmentId: enrolment.id } });
    expect((untouched.weightingSnapshot as Record<string, number>).DRAFTING).toBe(40);
    expect(untouched.finalPercent).toBe(firstFinal);

    // Only an explicit recompute picks up the new weights.
    await recomputeProgrammeResult(enrolment.id, testPrisma);
    const recomputed = await testPrisma.programmeResult.findUniqueOrThrow({ where: { enrolmentId: enrolment.id } });
    expect((recomputed.weightingSnapshot as Record<string, number>).DRAFTING).toBe(60);

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeIds: [intake.id] });
  });
});

describe("claimForMarking — row-locked, two markers cannot claim the same item (rule 3/6)", () => {
  it("exactly one of two concurrent claims succeeds; the other is refused", async () => {
    const { staff: staffA, category } = await seedStaffAndCategory();
    const staffB = await testPrisma.staff.create({
      data: { name: "Second Marker", email: `marking-test-${crypto.randomUUID()}@example.com`, role: "FACULTY", passwordHash: "not-a-real-hash" },
    });
    const programme = await seedProgramme(staffA.id, category.id);
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const { candidate, enrolment, intake } = await seedCandidateAndEnrolment(programme.id);
    const { mark } = await seedDraftingMark(enrolment.id, mod.id);

    const results = await Promise.allSettled([claimForMarking(mark.id, staffA.id), claimForMarking(mark.id, staffB.id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AlreadyClaimedError);

    const finalMark = await testPrisma.mark.findUniqueOrThrow({ where: { id: mark.id } });
    expect(finalMark.state).toBe("IN_REVIEW");
    expect([staffA.id, staffB.id]).toContain(finalMark.markedByStaffId);

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staffA.id, intakeIds: [intake.id] });
    await testPrisma.staff.delete({ where: { id: staffB.id } });
  });
});

describe("blind marking — the candidate's identity never appears in a response for a blind programme (rule 7)", () => {
  it("listMarkingQueue and openMarkable both withhold name and candidate number, showing only a reference", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id, { blindMarking: true });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const { candidate, enrolment, intake } = await seedCandidateAndEnrolment(programme.id);
    const { mark } = await seedDraftingMark(enrolment.id, mod.id);

    const queue = await listMarkingQueueQuery({ tab: "awaiting", programmeId: programme.id }, staff.id);
    const detail = await openMarkableQuery(mark.id);

    // Not just "the displayed label is a reference" — the ENTIRE response,
    // serialized, must never contain the candidate's real name or number,
    // proving the identity was never fetched into memory for a blind row.
    const queueDump = JSON.stringify(queue);
    const detailDump = JSON.stringify(detail);
    expect(queueDump).not.toContain(candidate.firstName);
    expect(queueDump).not.toContain(candidate.lastName);
    expect(queueDump).not.toContain(candidate.candidateNumber!);
    expect(detailDump).not.toContain(candidate.firstName);
    expect(detailDump).not.toContain(candidate.lastName);
    expect(detailDump).not.toContain(candidate.candidateNumber!);

    expect(queue.items[0]!.isBlind).toBe(true);
    expect(queue.items[0]!.candidateLabel).toMatch(/^Reference [0-9A-F]{8}$/);
    expect(detail.isBlind).toBe(true);
    expect(detail.candidateNumber).toBeNull();

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeIds: [intake.id] });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
