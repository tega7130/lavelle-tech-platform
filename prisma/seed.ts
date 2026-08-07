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
  IntakeType,
  Grade,
  CertificateStatus,
  ProfessionalStatus,
  ExperienceBand,
  LectureMediaKind,
  AssessmentKind,
} from "../src/generated/prisma/client";
import { ROLE_PRESETS } from "../src/lib/permissions";

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

  // ── Intakes ──
  const [, , sep26] = await Promise.all([
    prisma.intake.upsert({
      where: { type_startDate: { type: IntakeType.JANUARY, startDate: new Date("2026-01-12") } },
      update: {},
      create: { label: "January 2026", type: IntakeType.JANUARY, startDate: new Date("2026-01-12") },
    }),
    prisma.intake.upsert({
      where: { type_startDate: { type: IntakeType.APRIL, startDate: new Date("2026-04-13") } },
      update: {},
      create: { label: "April 2026", type: IntakeType.APRIL, startDate: new Date("2026-04-13") },
    }),
    prisma.intake.upsert({
      where: { type_startDate: { type: IntakeType.SEPTEMBER, startDate: new Date("2026-09-07") } },
      update: {},
      create: { label: "September 2026", type: IntakeType.SEPTEMBER, startDate: new Date("2026-09-07") },
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

  // A cohort for the flagship active programme, September 2026 intake.
  const cohort = await prisma.cohort.upsert({
    where: {
      programmeId_intakeId_label: {
        programmeId: elr.id,
        intakeId: sep26.id,
        label: "ELR-201 · Sep 2026",
      },
    },
    update: {},
    create: { programmeId: elr.id, intakeId: sep26.id, label: "ELR-201 · Sep 2026" },
  });

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
          status: "ACTIVE",
          enrolledAt: new Date("2026-07-02"),
        },
      },
    },
  });

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
  console.log("Candidate login: c.okonji@chambers.ng (enrolled) · i.danjuma@example.com (applicant)");
  console.log("Staff login: a.obi@lavelle.ng (Super Admin) · k.balogun@lavelle.ng (Academic Admin) · see prisma/seed.ts for the rest");
  console.log("Programme: ELR-201 — 4 modules, 20 lectures, per-module quizzes, weights 20/40/40, ACTIVE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
