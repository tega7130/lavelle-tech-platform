// Seed data lifted from the design handoffs' "Reference data" sections —
// fictional, but exact where a README gives exact values (identifiers,
// fees, dates, copy). Run via `npx prisma migrate dev` (auto-seeds) or
// `npx prisma db seed`.
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  StaffRole,
  ProgrammeTier,
  ProgrammeStatus,
  IntakeMonth,
  IntakeStatus,
  PaymentPurpose,
  PaymentStatus,
  Grade,
  CertificateStatus,
  ProfessionalStatus,
  ExperienceBand,
  LectureMediaKind,
  AssessmentKind,
  LectureState,
  SubmissionState,
  MarkState,
  MarkableKind,
} from "../src/generated/prisma/client";
import { ROLE_PRESETS } from "../src/lib/permissions";
import { generateDeadlinesForEnrolment } from "../src/lib/deadline-generation";
import { recomputeProgrammeResult } from "../src/lib/programme-result";
import { resolveGradeBand } from "../src/lib/grading";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Lavelle2026!";

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD);

  // ── Staff — one per role, per Handoff 00's "Roles and their colours" table ──
  // Seeded before programmes: Programme.createdByStaffId is required.
  const staffSeeds = [
    { email: "a.obi@lavelle.ng", name: "Adaeze Obi", jobTitle: "Registrar", department: "Institution", role: StaffRole.SUPER_ADMIN },
    { email: "b.eze@lavelle.ng", name: "Bassey Eze", jobTitle: "Operations Manager", department: "Operations", role: StaffRole.OPERATIONS_ADMIN },
    { email: "f.udo@lavelle.ng", name: "Funmi Udo", jobTitle: "Finance Officer", department: "Finance", role: StaffRole.FINANCE_ADMIN },
    { email: "k.balogun@lavelle.ng", name: "Kemi Balogun", jobTitle: "Academic Coordinator", department: "Academic", role: StaffRole.ACADEMIC_ADMIN },
    { email: "t.nwachukwu@lavelle.ng", name: "Tunde Nwachukwu", jobTitle: "Faculty — Energy Law", department: "Faculty", role: StaffRole.FACULTY },
    { email: "h.suleiman@lavelle.ng", name: "Hauwa Suleiman", jobTitle: "Support Agent", department: "Support", role: StaffRole.SUPPORT_AGENT },
  ] as const;

  const staff: Record<string, Awaited<ReturnType<typeof prisma.staff.upsert>>> = {};
  for (const s of staffSeeds) {
    const row = await prisma.staff.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, passwordHash },
    });
    staff[s.email] = row;
    // Seed each staff member's permission set from their role's preset —
    // matches applyRolePreset's "replaces the current set" semantics.
    await prisma.permissionGrant.deleteMany({ where: { staffId: row.id } });
    await prisma.permissionGrant.createMany({
      data: ROLE_PRESETS[s.role].map((permission) => ({ staffId: row.id, permission, granted: true })),
    });
  }
  const academicAdmin = staff["k.balogun@lavelle.ng"]!;
  const faculty = staff["t.nwachukwu@lavelle.ng"]!;

  // ── Grade bands (Slice 05) — DATA, not constants (rule 2), so an
  // institution can change its scale without a migration. effectiveFrom
  // predates every seeded assessment so band resolution always finds a
  // definition in force. Guarded on an existing-rows check so reseeding
  // never duplicates the scale.
  const existingGradeBands = await prisma.gradeBandDefinition.count();
  if (existingGradeBands === 0) {
    await prisma.gradeBandDefinition.createMany({
      data: [
        { band: "DISTINCTION", minPercent: 70, label: "Distinction", effectiveFrom: new Date("2025-01-01") },
        { band: "MERIT", minPercent: 60, label: "Merit", effectiveFrom: new Date("2025-01-01") },
        { band: "PASS", minPercent: 50, label: "Pass", effectiveFrom: new Date("2025-01-01") },
        { band: "REFER", minPercent: 0, label: "Refer", effectiveFrom: new Date("2025-01-01") },
      ],
    });
  }

  // ── Intakes — only January, April, September exist (README: other
  // months are not selectable without registrar override) ──
  const [jan26, apr26, sep26] = await Promise.all([
    prisma.intake.upsert({
      where: { month_year: { month: IntakeMonth.JANUARY, year: 2026 } },
      update: {},
      create: {
        month: IntakeMonth.JANUARY,
        year: 2026,
        status: IntakeStatus.IN_PROGRESS,
        enrolmentOpensAt: new Date("2025-11-01"),
        enrolmentClosesAt: new Date("2026-01-09"),
        startsAt: new Date("2026-01-12"),
      },
    }),
    prisma.intake.upsert({
      where: { month_year: { month: IntakeMonth.APRIL, year: 2026 } },
      update: {},
      create: {
        month: IntakeMonth.APRIL,
        year: 2026,
        status: IntakeStatus.OPEN,
        enrolmentOpensAt: new Date("2026-02-01"),
        enrolmentClosesAt: new Date("2026-04-10"),
        startsAt: new Date("2026-04-13"),
      },
    }),
    prisma.intake.upsert({
      where: { month_year: { month: IntakeMonth.SEPTEMBER, year: 2026 } },
      update: {},
      create: {
        month: IntakeMonth.SEPTEMBER,
        year: 2026,
        status: IntakeStatus.OPEN,
        enrolmentOpensAt: new Date("2026-06-01"),
        enrolmentClosesAt: new Date("2026-09-04"),
        startsAt: new Date("2026-09-07"),
      },
    }),
  ]);

  // ── Programme categories — exact names from Lavelle Admin.dc.html's category picker ──
  const CATEGORY_NAMES = [
    "Energy & Natural Resources",
    "Tax & Revenue",
    "Corporate & Commercial",
    "Regulatory Compliance",
    "Maritime & Admiralty",
    "Dispute Resolution",
  ];
  const categories: Record<string, Awaited<ReturnType<typeof prisma.programmeCategory.upsert>>> = {};
  for (const name of CATEGORY_NAMES) {
    categories[name] = await prisma.programmeCategory.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }

  const TIER_DEFAULTS = {
    [ProgrammeTier.FOUNDATION]: { weeks: 8, credits: 12, weeklyHoursLabel: "4–6 hrs / week" },
    [ProgrammeTier.SPECIALIST]: { weeks: 12, credits: 24, weeklyHoursLabel: "6–8 hrs / week" },
    [ProgrammeTier.ADVANCED_PRACTITIONER]: { weeks: 16, credits: 36, weeklyHoursLabel: "8–10 hrs / week" },
  };

  // The one COMPLETE programme this slice's README asks for — later
  // slices (catalogue, player, exam bank) read this for real.
  const elr = await prisma.programme.upsert({
    where: { code: "ELR-201" },
    update: {},
    create: {
      code: "ELR-201",
      title: "Energy Law & Regulation",
      categoryId: categories["Energy & Natural Resources"]!.id,
      tier: ProgrammeTier.SPECIALIST,
      status: ProgrammeStatus.ACTIVE,
      summary:
        "A four-module specialization programme for practitioners advising on upstream and midstream matters in Nigeria.",
      ...TIER_DEFAULTS[ProgrammeTier.SPECIALIST],
      feeMinor: 45_000_000, // ₦450,000
      createdByStaffId: academicAdmin.id,
    },
  });

  // Assessment weighting — quizzes 20% / drafting 40% / examination 40%,
  // must total exactly 100 (rule 6).
  for (const [kind, weightPercent] of [
    [AssessmentKind.QUIZ, 20],
    [AssessmentKind.DRAFTING, 40],
    [AssessmentKind.EXAMINATION, 40],
  ] as const) {
    await prisma.assessmentWeighting.upsert({
      where: { programmeId_kind: { programmeId: elr.id, kind } },
      update: {},
      create: { programmeId: elr.id, kind, weightPercent },
    });
  }

  // Four modules of five lectures each, titles verbatim from the design
  // reference's BUILDER_LECTURES.
  const MODULE_SEEDS = [
    {
      week: 1,
      title: "Upstream Petroleum Contracts & Licensing",
      lectures: [
        "Concession & PSC Fundamentals",
        "Licensing Round Procedure",
        "Farm-in / Farm-out Structures",
        "Royalty & Fiscal Terms",
        "Case Study: Marginal Field",
      ],
    },
    {
      week: 2,
      title: "Regulatory Compliance & the NUPRC Framework",
      lectures: [
        "NUPRC Act Overview",
        "Local Content Compliance",
        "Environmental & HSE Obligations",
        "Compliance Reporting Cycles",
        "Enforcement & Sanctions",
      ],
    },
    {
      week: 3,
      title: "Energy Transactions & Project Finance",
      lectures: [
        "Project Finance Structures",
        "Security & Step-in Rights",
        "Offtake Agreements",
        "Risk Allocation",
        "Case Study: LNG Financing",
      ],
    },
    {
      week: 4,
      title: "Dispute Resolution in the Energy Sector",
      lectures: [
        "Arbitration Clauses",
        "Investor-State Disputes",
        "Expert Determination",
        "Enforcement of Awards",
        "Case Study: ICSID Matter",
      ],
    },
  ];

  let flatIdx = 0;
  for (const [mi, mod] of MODULE_SEEDS.entries()) {
    const moduleRow = await prisma.module.upsert({
      where: { programmeId_weekNumber: { programmeId: elr.id, weekNumber: mod.week } },
      update: {},
      create: {
        programmeId: elr.id,
        weekNumber: mod.week,
        title: mod.title,
        examQuestionDraw: 2,
        orderIndex: mi,
      },
    });

    for (const [li, title] of mod.lectures.entries()) {
      const existing = await prisma.lecture.findFirst({ where: { moduleId: moduleRow.id, title } });
      if (!existing) {
        await prisma.lecture.create({
          data: {
            moduleId: moduleRow.id,
            orderIndex: li,
            title,
            mediaKind: flatIdx < 9 ? LectureMediaKind.VIDEO : LectureMediaKind.SLIDES,
          },
        });
      }
      flatIdx++;
    }

    // One module-close quiz per module (rule: exactly one quiz per module).
    const quiz = await prisma.quiz.upsert({
      where: { moduleId: moduleRow.id },
      update: {},
      create: { moduleId: moduleRow.id, passMarkPercent: 60 },
    });
    const existingQuestions = await prisma.quizQuestion.count({ where: { quizId: quiz.id } });
    if (existingQuestions === 0) {
      await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          orderIndex: 0,
          prompt: `Which statement best reflects the position covered in "${mod.title}"?`,
          marks: 1,
          explanation: "Reviewed in the module's lecture materials.",
          options: {
            create: [
              { orderIndex: 0, text: "The position as set out in the module lectures", isCorrect: true },
              { orderIndex: 1, text: "A superseded position no longer in force", isCorrect: false },
              { orderIndex: 2, text: "A position applicable only outside Nigeria", isCorrect: false },
            ],
          },
        },
      });
    }
  }

  // ── Author Module 1's lecture content (Slice 04) ──
  // Only Module 1 gets real scenario/drafting prompts and video URLs — the
  // other three exist so the catalogue/overview shows a full four-module
  // programme, but this slice's own scope is the player, not authoring
  // twenty lectures of content. Deliberately varied step counts, since
  // deriveLectureSteps() must never assume a fixed four: lecture 1 is a
  // three-step lecture (content/scenario/drafting), lecture 3 is
  // content-only, and lecture 5 (last in the module) is the full four
  // steps including the module quiz. Guarded on scenarioPrompt IS NULL so
  // a reseed never clobbers a live admin edit made through Slice 02's
  // content builder.
  const module1 = await prisma.module.findFirstOrThrow({ where: { programmeId: elr.id, weekNumber: 1 } });
  const module1Lectures = await prisma.lecture.findMany({ where: { moduleId: module1.id }, orderBy: { orderIndex: "asc" } });
  const LECTURE_CONTENT = [
    {
      videoUrl: "https://cdn.lavelle.ng/video/elr-201-w1-l1.mp4",
      scenarioPrompt:
        "Your client, an indigenous E&P company, has been offered a farm-in on a marginal field under a Production Sharing Contract. Identify the fiscal terms that most affect the deal's viability.",
      scenarioGuidance: "Consider royalty rates, cost oil recovery limits, and profit oil split under the applicable PSC.",
      draftingPrompt: "Draft a one-paragraph risk note to the client on the PSC's cost-recovery ceiling and its effect on their expected return.",
      draftingWordLimit: 300,
    },
    {
      videoUrl: "https://cdn.lavelle.ng/video/elr-201-w1-l2.mp4",
      scenarioPrompt:
        "NUPRC has announced a new licensing round. Your client wants to understand the pre-qualification criteria before committing resources to a bid.",
      scenarioGuidance: "Focus on technical and financial capability thresholds and local content commitments.",
      draftingPrompt: null,
      draftingWordLimit: null,
    },
    {
      videoUrl: "https://cdn.lavelle.ng/video/elr-201-w1-l3.mp4",
      scenarioPrompt: null,
      scenarioGuidance: null,
      draftingPrompt: null,
      draftingWordLimit: null,
    },
    {
      videoUrl: "https://cdn.lavelle.ng/video/elr-201-w1-l4.mp4",
      scenarioPrompt: null,
      scenarioGuidance: null,
      draftingPrompt: "Draft the royalty clause of a farm-out agreement, reflecting a sliding scale tied to production volume.",
      draftingWordLimit: 250,
    },
    {
      videoUrl: "https://cdn.lavelle.ng/video/elr-201-w1-l5.mp4",
      scenarioPrompt:
        "A marginal field operator is negotiating a farm-out with an indigenous company that lacks the operator's balance sheet strength. Advise on structuring the carry.",
      scenarioGuidance: "Weigh a full carry against a capped/loan-back carry, and the security package that should accompany either.",
      draftingPrompt: "Draft the carry and reimbursement clause for the farm-out agreement described in the scenario.",
      draftingWordLimit: 350,
    },
  ];
  for (const [i, lec] of module1Lectures.entries()) {
    const content = LECTURE_CONTENT[i];
    if (!content || lec.scenarioPrompt !== null || lec.draftingPrompt !== null) continue;
    await prisma.lecture.update({
      where: { id: lec.id },
      data: {
        videoUrl: content.videoUrl,
        scenarioPrompt: content.scenarioPrompt,
        scenarioGuidance: content.scenarioGuidance,
        draftingPrompt: content.draftingPrompt,
        draftingWordLimit: content.draftingWordLimit,
      },
    });
  }

  // Examination — README "Reference data": ₦85,000 fee, 60% pass mark, 3 hours, proctored/remote.
  await prisma.examination.upsert({
    where: { programmeId: elr.id },
    update: {},
    create: {
      programmeId: elr.id,
      feeNaira: 85000,
      durationMinutes: 180,
      passMarkPct: 60,
      proctored: true,
      remote: true,
      published: true,
    },
  });

  // Cohorts for the flagship active programme, across all three intakes —
  // codes match the design reference (e.g. "SPEC-ENR-03").
  const [cohortJan] = await Promise.all([
    prisma.cohort.upsert({
      where: { code: "SPEC-ENR-01" },
      update: {},
      create: {
        code: "SPEC-ENR-01",
        programmeId: elr.id,
        intakeId: jan26.id,
        capacity: 20,
        facultyLeadStaffId: staff["t.nwachukwu@lavelle.ng"]!.id,
        status: "IN_PROGRESS",
      },
    }),
    prisma.cohort.upsert({
      where: { code: "SPEC-ENR-02" },
      update: {},
      create: {
        code: "SPEC-ENR-02",
        programmeId: elr.id,
        intakeId: apr26.id,
        capacity: 20,
        facultyLeadStaffId: staff["t.nwachukwu@lavelle.ng"]!.id,
        status: "OPEN",
      },
    }),
    prisma.cohort.upsert({
      where: { code: "SPEC-ENR-03" },
      update: {},
      create: {
        code: "SPEC-ENR-03",
        programmeId: elr.id,
        intakeId: sep26.id,
        capacity: 30,
        facultyLeadStaffId: staff["t.nwachukwu@lavelle.ng"]!.id,
        status: "OPEN",
      },
    }),
  ]);
  // Chiamaka's cohort — moved to the January intake (Slice 04): the
  // September cohort hasn't started (intake.startsAt is in the future),
  // so a candidate on it can't legitimately have Module 1 progress yet —
  // LECTURE_RELEASE deadlines are generated from the intake's start date
  // and gate access in the player. January is IN_PROGRESS and already
  // under way, which is what "part-way through the programme" requires.
  const cohort = cohortJan;

  // A handful of DRAFT programmes (no modules yet) so the list screen has
  // something to filter/search — status stays DRAFT because a programme
  // with zero modules cannot legitimately be ACTIVE (rule 2).
  const draftSeeds = [
    { code: "TLC-201", title: "Tax Law & Compliance", tier: ProgrammeTier.SPECIALIST, category: "Tax & Revenue", feeMinor: 45_000_000 },
    { code: "MAL-201", title: "Maritime & Admiralty Law", tier: ProgrammeTier.SPECIALIST, category: "Maritime & Admiralty", feeMinor: 45_000_000 },
    { code: "RCF-101", title: "Regulatory Compliance Foundations", tier: ProgrammeTier.FOUNDATION, category: "Regulatory Compliance", feeMinor: 28_000_000 },
    { code: "CCP-101", title: "Corporate & Commercial Practice", tier: ProgrammeTier.FOUNDATION, category: "Corporate & Commercial", feeMinor: 28_000_000 },
    {
      code: "AEP-301",
      title: "Advanced Energy Practice",
      tier: ProgrammeTier.ADVANCED_PRACTITIONER,
      category: "Energy & Natural Resources",
      feeMinor: 68_000_000,
      prerequisiteTier: ProgrammeTier.SPECIALIST,
    },
    // Back the Verify-portal sample register faithfully (Handoff 00's "verify" reference data).
    { code: "FCE-101", title: "Foundation Certificate in Energy Law", tier: ProgrammeTier.FOUNDATION, category: "Energy & Natural Resources", feeMinor: 28_000_000 },
    { code: "IRP-101", title: "Introduction to Regulatory Practice", tier: ProgrammeTier.FOUNDATION, category: "Regulatory Compliance", feeMinor: 28_000_000 },
  ] as const;

  const programmes: Record<string, Awaited<ReturnType<typeof prisma.programme.upsert>>> = { "ELR-201": elr };
  for (const p of draftSeeds) {
    programmes[p.code] = await prisma.programme.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        title: p.title,
        categoryId: categories[p.category]!.id,
        tier: p.tier,
        status: ProgrammeStatus.DRAFT,
        summary: `${p.title} — programme details to be completed by faculty.`,
        feeMinor: p.feeMinor,
        prerequisiteTier: "prerequisiteTier" in p ? p.prerequisiteTier : undefined,
        createdByStaffId: academicAdmin.id,
        ...TIER_DEFAULTS[p.tier],
      },
    });
  }

  // ── Candidates ──
  // is_enrolled is derived from candidateNumber !== null — never a stored
  // flag (Handoff 01 rule 1). Chiamaka has one, so she renders the
  // enrolled shell; Ibrahim doesn't, so he renders the applicant shell.
  const chiamaka = await prisma.candidate.upsert({
    where: { email: "c.okonji@chambers.ng" },
    update: {},
    create: {
      applicantNumber: "LVL-APP-2026-04412",
      candidateNumber: "LVL/2026/00291",
      firstName: "Chiamaka",
      lastName: "Okonji",
      email: "c.okonji@chambers.ng",
      phone: "803 552 8841",
      passwordHash,
      acceptedTermsAt: new Date(),
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        create: {
          professionalStatus: ProfessionalStatus.PRACTISING_LAWYER,
          yearOfCall: 2016,
          scnNumber: "SCN123456",
          experienceBand: ExperienceBand.Y6_10,
          placeOfPractice: "Lagos State, Nigeria",
          handbookAcknowledgedAt: new Date(),
          completedAt: new Date(),
        },
      },
      enrolments: {
        create: {
          programmeId: elr.id,
          cohortId: cohort.id,
          intakeId: jan26.id,
          status: "ACTIVE",
          enrolledAt: new Date("2026-07-02"),
        },
      },
    },
    include: { enrolments: true },
  });
  const chiamakaEnrolment = chiamaka.enrolments[0]!;

  // Her confirmed payment and ID card — a candidateNumber implies both
  // exist, so seed them for real rather than leaving the number dangling
  // with nothing behind it (the finance ledger and candidate record read
  // these directly).
  await prisma.payment.upsert({
    where: { internalReference: "LVL-PAY-2026-00291" },
    update: {},
    create: {
      candidateId: chiamaka.id,
      purpose: PaymentPurpose.PROGRAMME_FEE,
      enrolmentId: chiamakaEnrolment.id,
      amountMinor: 45_000_000,
      provider: "paystack",
      providerReference: "PSK-8842-KX19",
      internalReference: "LVL-PAY-2026-00291",
      status: PaymentStatus.SUCCESS,
      initiatedAt: new Date("2026-07-02T09:10:00Z"),
      confirmedAt: new Date("2026-07-02T09:11:00Z"),
    },
  });
  await prisma.idCard.upsert({
    where: { cardNumber: "LVL/2026/00291" },
    update: {},
    create: {
      candidateId: chiamaka.id,
      cardNumber: "LVL/2026/00291",
      tier: ProgrammeTier.SPECIALIST,
      issuedAt: new Date("2026-07-02T09:11:00Z"),
      validUntil: new Date("2027-12-31"),
    },
  });

  // ── Deadlines + part-way progress for Chiamaka (Slice 04) ──
  // The Slice 03 enrolment transaction generates deadlines automatically,
  // but Chiamaka's enrolment above was seeded directly (not through that
  // transaction, which requires a real Payment to confirm) — generated
  // here explicitly so her enrolment isn't the one candidate in the
  // system with an active enrolment and no schedule. Guarded on an
  // existing-deadlines check so reseeding never duplicates rows.
  const existingDeadlines = await prisma.deadline.count({ where: { enrolmentId: chiamakaEnrolment.id } });
  if (existingDeadlines === 0) {
    await generateDeadlinesForEnrolment(chiamakaEnrolment.id, prisma);
  }

  // She's part-way through Module 1: lecture 1 finished (all three of its
  // authored steps — content, scenario, drafting), lecture 2 started but
  // not finished. Lectures 3-5 and every later module are left with no
  // LectureProgress row at all — NOT_STARTED is the absence of a row, not
  // a stored value (rule 2).
  if (module1Lectures[0] && module1Lectures[1]) {
    await prisma.lectureProgress.upsert({
      where: { enrolmentId_lectureId: { enrolmentId: chiamakaEnrolment.id, lectureId: module1Lectures[0].id } },
      update: {},
      create: {
        enrolmentId: chiamakaEnrolment.id,
        lectureId: module1Lectures[0].id,
        state: LectureState.COMPLETED,
        stepsCompleted: ["content", "scenario", "drafting"],
        startedAt: new Date("2026-07-03T08:00:00Z"),
        completedAt: new Date("2026-07-03T08:52:00Z"),
        lastSeenAt: new Date("2026-07-03T08:52:00Z"),
      },
    });
    await prisma.draftingSubmission.upsert({
      where: { enrolmentId_lectureId_attemptNumber: { enrolmentId: chiamakaEnrolment.id, lectureId: module1Lectures[0].id, attemptNumber: 1 } },
      update: {},
      create: {
        enrolmentId: chiamakaEnrolment.id,
        lectureId: module1Lectures[0].id,
        state: SubmissionState.SUBMITTED,
        body: "The cost-recovery ceiling under the PSC caps the contractor's annual recovery of cost oil at 80% of production, deferring the balance to later years. For a marginal field with a compressed payback horizon, this materially slows the client's return...",
        wordCount: 287,
        submittedAt: new Date("2026-07-03T08:50:00Z"),
      },
    });

    await prisma.lectureProgress.upsert({
      where: { enrolmentId_lectureId: { enrolmentId: chiamakaEnrolment.id, lectureId: module1Lectures[1].id } },
      update: {},
      create: {
        enrolmentId: chiamakaEnrolment.id,
        lectureId: module1Lectures[1].id,
        state: LectureState.IN_PROGRESS,
        stepsCompleted: ["content"],
        slideIndex: 0,
        mediaPositionSeconds: 240,
        startedAt: new Date("2026-08-06T19:10:00Z"),
        lastSeenAt: new Date("2026-08-06T19:24:00Z"),
      },
    });
  }

  // ── A further-along candidate with marked work and no examination
  // (Slice 05) ──
  // Amara Nwosu has finished Module 1 entirely — quiz submitted (system-
  // graded) and all three of its drafting exercises marked and returned
  // by faculty — and started Module 2. Slice 06 (the examination) doesn't
  // exist yet, so examinationPercent is always null regardless of who's
  // seeded; this candidate exists to exercise the PROVISIONAL weighted
  // result specifically (rule 4): a strong quiz+drafting showing must
  // never read as a failing mark just because the exam hasn't happened.
  const amara = await prisma.candidate.upsert({
    where: { email: "a.nwosu@chambers.ng" },
    update: {},
    create: {
      applicantNumber: "LVL-APP-2026-04298",
      candidateNumber: "LVL/2026/00305",
      firstName: "Amara",
      lastName: "Nwosu",
      email: "a.nwosu@chambers.ng",
      phone: "803 552 9910",
      passwordHash,
      emailVerifiedAt: new Date("2026-01-05"),
      acceptedTermsAt: new Date("2026-01-05"),
      profile: {
        create: {
          professionalStatus: ProfessionalStatus.PRACTISING_LAWYER,
          yearOfCall: 2019,
          scnNumber: "SCN-88214",
          placeOfPractice: "Lagos",
          handbookAcknowledgedAt: new Date(),
          completedAt: new Date(),
        },
      },
      enrolments: {
        create: {
          programmeId: elr.id,
          cohortId: cohort.id,
          intakeId: jan26.id,
          status: "ACTIVE",
          enrolledAt: new Date("2026-01-14"),
        },
      },
    },
    include: { enrolments: true },
  });
  const amaraEnrolment = amara.enrolments[0]!;

  await prisma.payment.upsert({
    where: { internalReference: "LVL-PAY-2026-00305" },
    update: {},
    create: {
      candidateId: amara.id,
      purpose: PaymentPurpose.PROGRAMME_FEE,
      enrolmentId: amaraEnrolment.id,
      amountMinor: 45_000_000,
      provider: "paystack",
      providerReference: "PSK-9931-QW44",
      internalReference: "LVL-PAY-2026-00305",
      status: PaymentStatus.SUCCESS,
      initiatedAt: new Date("2026-01-14T10:00:00Z"),
      confirmedAt: new Date("2026-01-14T10:01:00Z"),
    },
  });

  const existingAmaraDeadlines = await prisma.deadline.count({ where: { enrolmentId: amaraEnrolment.id } });
  if (existingAmaraDeadlines === 0) {
    await generateDeadlinesForEnrolment(amaraEnrolment.id, prisma);
  }

  const module2 = await prisma.module.findFirstOrThrow({ where: { programmeId: elr.id, weekNumber: 2 } });
  const module2Lectures = await prisma.lecture.findMany({ where: { moduleId: module2.id }, orderBy: { orderIndex: "asc" } });
  const module1Quiz = await prisma.quiz.findUniqueOrThrow({ where: { moduleId: module1.id } });

  if (module1Lectures.length === 5 && module2Lectures[0]) {
    const [lec1, lec2, lec3, lec4, lec5] = module1Lectures;
    const now = new Date("2026-02-10T12:00:00Z");

    // Module 1 — every lecture COMPLETED.
    const stepsByLecture: { lecture: (typeof module1Lectures)[number]; steps: string[] }[] = [
      { lecture: lec1!, steps: ["content", "scenario", "drafting"] },
      { lecture: lec2!, steps: ["content", "scenario"] },
      { lecture: lec3!, steps: ["content"] },
      { lecture: lec4!, steps: ["content", "drafting"] },
      { lecture: lec5!, steps: ["content", "scenario", "drafting", "quiz"] },
    ];
    for (const { lecture, steps } of stepsByLecture) {
      await prisma.lectureProgress.upsert({
        where: { enrolmentId_lectureId: { enrolmentId: amaraEnrolment.id, lectureId: lecture.id } },
        update: {},
        create: {
          enrolmentId: amaraEnrolment.id,
          lectureId: lecture.id,
          state: LectureState.COMPLETED,
          stepsCompleted: steps,
          startedAt: new Date("2026-01-15"),
          completedAt: new Date("2026-01-20"),
          lastSeenAt: new Date("2026-01-20"),
        },
      });
    }

    // Drafting exercises — submitted then marked and returned by faculty.
    const draftingSeeds = [
      { lecture: lec1!, body: "The concession must be read against the current fiscal terms before advising on viability...", wordCount: 310, scorePercent: 82 },
      { lecture: lec4!, body: "The royalty clause should adopt a sliding scale tied to realised price, not headline production...", wordCount: 240, scorePercent: 64 },
      { lecture: lec5!, body: "A capped carry, secured against future cost oil, best balances the parties' positions here...", wordCount: 340, scorePercent: 55 },
    ];
    for (const d of draftingSeeds) {
      const submission = await prisma.draftingSubmission.upsert({
        where: { enrolmentId_lectureId_attemptNumber: { enrolmentId: amaraEnrolment.id, lectureId: d.lecture.id, attemptNumber: 1 } },
        update: {},
        create: {
          enrolmentId: amaraEnrolment.id,
          lectureId: d.lecture.id,
          state: SubmissionState.RETURNED,
          body: d.body,
          wordCount: d.wordCount,
          submittedAt: new Date("2026-01-18"),
        },
      });
      const existingMark = await prisma.mark.findUnique({ where: { draftingSubmissionId: submission.id } });
      if (!existingMark) {
        const band = await resolveGradeBand(d.scorePercent, now, prisma);
        await prisma.mark.create({
          data: {
            enrolmentId: amaraEnrolment.id,
            kind: MarkableKind.DRAFTING,
            draftingSubmissionId: submission.id,
            state: MarkState.RETURNED,
            scorePercent: d.scorePercent,
            band,
            feedback: "Sound on the law and clearly structured. Tighten the drafting precision on the operative clause — see the marked-up paragraph.",
            markedByStaffId: faculty.id,
            markedAt: now,
          },
        });
      }
      await prisma.deadline.updateMany({
        where: { enrolmentId: amaraEnrolment.id, lectureId: d.lecture.id, kind: "DRAFTING_DUE", metAt: null },
        data: { metAt: new Date("2026-01-18") },
      });
    }

    // Module 1 quiz — system-graded on submission, no faculty marking involved.
    const existingAttempt = await prisma.quizAttempt.findFirst({ where: { enrolmentId: amaraEnrolment.id, quizId: module1Quiz.id } });
    if (!existingAttempt) {
      await prisma.quizAttempt.create({
        data: {
          enrolmentId: amaraEnrolment.id,
          quizId: module1Quiz.id,
          scorePercent: 100,
          passed: true,
          startedAt: new Date("2026-01-19T09:00:00Z"),
          submittedAt: new Date("2026-01-19T09:04:00Z"),
        },
      });
    }
    await prisma.deadline.updateMany({
      where: { enrolmentId: amaraEnrolment.id, moduleId: module1.id, kind: "QUIZ_DUE", metAt: null },
      data: { metAt: new Date("2026-01-19T09:04:00Z") },
    });

    // Module 2, lecture 1 — started, not finished.
    await prisma.lectureProgress.upsert({
      where: { enrolmentId_lectureId: { enrolmentId: amaraEnrolment.id, lectureId: module2Lectures[0].id } },
      update: {},
      create: {
        enrolmentId: amaraEnrolment.id,
        lectureId: module2Lectures[0].id,
        state: LectureState.IN_PROGRESS,
        stepsCompleted: [],
        mediaPositionSeconds: 60,
        startedAt: new Date("2026-01-21"),
        lastSeenAt: new Date("2026-01-21"),
      },
    });

    await recomputeProgrammeResult(amaraEnrolment.id, prisma);
  }

  // A second candidate who has registered but not paid, to demonstrate
  // applicant nav gating and an incomplete profile checklist.
  await prisma.candidate.upsert({
    where: { email: "i.danjuma@example.com" },
    update: {},
    create: {
      applicantNumber: "LVL-APP-2026-05107",
      firstName: "Ibrahim",
      lastName: "Danjuma",
      email: "i.danjuma@example.com",
      phone: "802 118 4420",
      passwordHash,
      acceptedTermsAt: new Date(),
      profile: { create: {} },
    },
  });

  // A third candidate — profile complete, email verified, no payment or
  // enrolment yet — ready to browse the catalogue and enrol for real
  // (Slice 03's seed requirement). Named for the finance ledger design
  // reference's own "payment still pending" candidate.
  await prisma.candidate.upsert({
    where: { email: "n.adeleke@example.com" },
    update: {},
    create: {
      applicantNumber: "LVL-APP-2026-05884",
      firstName: "Ngozi",
      lastName: "Adeleke",
      email: "n.adeleke@example.com",
      phone: "805 221 7734",
      passwordHash,
      acceptedTermsAt: new Date(),
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          professionalStatus: ProfessionalStatus.PRACTISING_LAWYER,
          yearOfCall: 2019,
          scnNumber: "SCN881204",
          experienceBand: ExperienceBand.Y3_5,
          placeOfPractice: "Abuja, Nigeria",
          handbookAcknowledgedAt: new Date(),
          completedAt: new Date(),
        },
      },
    },
  });

  // ── Certificates — Handoff 00's verify-portal register, faithfully reproduced ──
  await prisma.certificate.upsert({
    where: { identifier: "LVL-CERT-2025-00790" },
    update: {},
    create: {
      identifier: "LVL-CERT-2025-00790",
      candidateId: chiamaka.id,
      programmeId: programmes["FCE-101"]!.id,
      tier: ProgrammeTier.FOUNDATION,
      grade: Grade.DISTINCTION,
      issuedAt: new Date("2025-12-09"),
      status: CertificateStatus.ACTIVE,
    },
  });
  const revoked = await prisma.certificate.upsert({
    where: { identifier: "LVL-CERT-2025-00219" },
    update: {},
    create: {
      identifier: "LVL-CERT-2025-00219",
      candidateId: chiamaka.id,
      programmeId: programmes["IRP-101"]!.id,
      tier: ProgrammeTier.FOUNDATION,
      grade: Grade.MERIT,
      issuedAt: new Date("2025-11-08"),
      status: CertificateStatus.REVOKED,
      revokedReason: "Assessment integrity finding of the examinations panel",
      revokedAt: new Date("2025-11-19"),
    },
  });
  await prisma.certificate.upsert({
    where: { identifier: "LVL-CERT-2026-01188" },
    update: {},
    create: {
      identifier: "LVL-CERT-2026-01188",
      candidateId: chiamaka.id,
      programmeId: programmes["IRP-101"]!.id,
      tier: ProgrammeTier.FOUNDATION,
      grade: Grade.MERIT,
      issuedAt: new Date("2026-08-04"),
      status: CertificateStatus.ACTIVE,
      replacesCertificateId: revoked.id,
    },
  });

  console.log(`Seeded. Demo password for every account: ${DEMO_PASSWORD}`);
  console.log(
    "Candidate login: c.okonji@chambers.ng (enrolled, LVL/2026/00291) · i.danjuma@example.com (applicant, incomplete profile) · n.adeleke@example.com (applicant, profile complete, ready to enrol)"
  );
  console.log("Staff login: a.obi@lavelle.ng (Super Admin) · k.balogun@lavelle.ng (Academic Admin) · f.udo@lavelle.ng (Finance Officer) · see prisma/seed.ts for the rest");
  console.log("Programme: ELR-201 — 4 modules, 20 lectures, per-module quizzes, weights 20/40/40, ACTIVE");
  console.log("Intakes: January 2026 (in progress) · April 2026 (open) · September 2026 (open) — cohorts SPEC-ENR-01/02/03 on ELR-201");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
