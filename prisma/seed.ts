// Seed data lifted from the design handoffs' "Reference data" sections —
// fictional, but exact where a README gives exact values (identifiers,
// fees, dates, copy). Run via `npx prisma migrate dev` (auto-seeds) or
// `npx prisma db seed`.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  StaffRole,
  StaffStatus,
  RequestCategory,
  ProgrammeTier,
  ProgrammeStatus,
  IntakeMonth,
  IntakeStatus,
  PaymentPurpose,
  PaymentStatus,
  GradeBand,
  CertificateStatus,
  CredentialPathway,
  ProfessionalStatus,
  ExperienceBand,
  LectureMediaKind,
  AssessmentKind,
  LectureState,
  SubmissionState,
  MarkState,
  MarkableKind,
  ExamStatus,
  ExamQuestionType,
  ExamQuestionStatus,
} from "../src/generated/prisma/client";
import { ROLE_PRESETS } from "../src/lib/permissions";
import { generateDeadlinesForEnrolment } from "../src/lib/deadline-generation";
import { recomputeProgrammeResult } from "../src/lib/programme-result";
import { resolveGradeBand } from "../src/lib/grading";
import { renderCertificatePdf } from "../src/lib/certificate-pdf";
import { tierLabel } from "../src/lib/format";

// storage.ts is marked "server-only", which throws unconditionally
// outside Next's own bundler (there is no such build step for this
// plain-tsx seed script, unlike the app or the Vitest suite, which
// aliases the package to a no-op) — so this writes directly to the same
// .local-storage/ root storage.ts itself uses, rather than importing it.
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), ".local-storage");
async function writeSeedBlob(storageKey: string, data: Buffer) {
  const filePath = path.join(LOCAL_STORAGE_ROOT, storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Lavelle2026!";

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

// Mirrors staff-invitation.ts's hashToken exactly (sha256 of the
// plaintext) — not imported directly since that file is "server-only"
// and throws outside Next's own bundler, same reason as storage.ts above.
function hashInvitationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Renders a real PDF for a seeded certificate the same way issueCertificate
 * does, so "Download PDF" works on the demo data too — without this, every
 * seeded certificate would have pdfAssetId null and 404 on download, since
 * these rows are inserted directly rather than through the real issuing
 * transaction. Idempotent on storageKey, matching the rest of this file.
 */
async function seedCertificatePdf(input: {
  certificateNumber: string;
  holderName: string;
  programmeTitle: string;
  tier: ProgrammeTier;
  band: GradeBand;
  pathway: "PATHWAY" | "EXAMINATION_ONLY";
  issuedAt: Date;
  signatoryBlock: string;
  staffId: string;
}) {
  const bandLabel = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" }[input.band];
  const pdfBytes = await renderCertificatePdf({
    certificateNumber: input.certificateNumber,
    holderName: input.holderName,
    programmeTitle: input.programmeTitle,
    tierLabel: tierLabel(input.tier),
    bandLabel,
    pathway: input.pathway,
    issuedAt: input.issuedAt,
    signatoryBlock: input.signatoryBlock,
  });
  const storageKey = `certificates/${input.certificateNumber}.pdf`;
  await writeSeedBlob(storageKey, pdfBytes);
  const asset = await prisma.mediaAsset.upsert({
    where: { storageKey },
    update: { bytes: pdfBytes.length },
    create: {
      kind: "document",
      storageKey,
      mimeType: "application/pdf",
      bytes: pdfBytes.length,
      originalFilename: `${input.certificateNumber}.pdf`,
      uploadedByStaffId: input.staffId,
    },
  });
  return asset.id;
}

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD);

  // ── Staff — one per role, per Handoff 08's "Roles and their colours" table ──
  // Seeded before programmes: Programme.createdByStaffId is required.
  // All ACTIVE (not the schema's INVITED default) — these are
  // already-provisioned demo accounts meant to sign in immediately, not
  // pending invitations.
  const staffSeeds = [
    { email: "a.obi@lavelle.ng", name: "Adaeze Obi", jobTitle: "Registrar", department: "Institution", role: StaffRole.SUPER_ADMIN },
    { email: "b.eze@lavelle.ng", name: "Bassey Eze", jobTitle: "Operations Manager", department: "Operations", role: StaffRole.REGISTRAR },
    { email: "f.udo@lavelle.ng", name: "Funmi Udo", jobTitle: "Finance Officer", department: "Finance", role: StaffRole.FINANCE },
    { email: "k.balogun@lavelle.ng", name: "Kemi Balogun", jobTitle: "Academic Coordinator", department: "Academic", role: StaffRole.ACADEMIC_ADMIN },
    { email: "t.nwachukwu@lavelle.ng", name: "Tunde Nwachukwu", jobTitle: "Faculty — Energy Law", department: "Faculty", role: StaffRole.FACULTY },
    { email: "h.suleiman@lavelle.ng", name: "Hauwa Suleiman", jobTitle: "Support Agent", department: "Support", role: StaffRole.SUPPORT },
    { email: "n.adeyemi@lavelle.ng", name: "Ngozi Adeyemi", jobTitle: "Compliance Observer", department: "Compliance", role: StaffRole.READ_ONLY },
  ] as const;

  const staff: Record<string, Awaited<ReturnType<typeof prisma.staff.upsert>>> = {};
  for (const s of staffSeeds) {
    const row = await prisma.staff.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, passwordHash, status: StaffStatus.ACTIVE },
    });
    staff[s.email] = row;
    // Seed each staff member's permission set from their role's preset —
    // matches applyRolePreset's "replaces the current set" semantics.
    // Self-granted: there is no earlier admin to attribute a fresh seed
    // account's own starting permissions to.
    await prisma.staffPermission.deleteMany({ where: { staffId: row.id } });
    await prisma.staffPermission.createMany({
      data: ROLE_PRESETS[s.role].map((permission) => ({ staffId: row.id, permission, grantedByStaffId: row.id })),
    });
  }
  // Slice 10: one INVITED account with a live, unexpired, unconsumed
  // token — so the Staff screen's amber "Invited" tag, "Awaiting
  // activation" and "Resend invitation" all have something real to show,
  // and the activation flow (/staff/set-password) can be exercised
  // end-to-end against a genuine seeded link. Also holds respond_support,
  // giving the assign dialog a third assignable name.
  const invitedEmail = "n.balogun@lavelle.ng";
  const invitedStaff = await prisma.staff.upsert({
    where: { email: invitedEmail },
    update: {},
    create: {
      email: invitedEmail,
      name: "Ngozi Balogun",
      jobTitle: "Support Agent",
      department: "Support",
      role: StaffRole.SUPPORT,
      status: StaffStatus.INVITED,
      passwordHash: null,
      invitedByStaffId: staff["a.obi@lavelle.ng"]!.id,
    },
  });
  await prisma.staffPermission.deleteMany({ where: { staffId: invitedStaff.id } });
  await prisma.staffPermission.createMany({
    data: ROLE_PRESETS[StaffRole.SUPPORT].map((permission) => ({ staffId: invitedStaff.id, permission, grantedByStaffId: staff["a.obi@lavelle.ng"]!.id })),
  });
  const existingInvitationTokens = await prisma.staffInvitationToken.count({ where: { staffId: invitedStaff.id } });
  if (existingInvitationTokens === 0) {
    const invitationToken = crypto.randomBytes(32).toString("base64url");
    await prisma.staffInvitationToken.create({
      data: {
        staffId: invitedStaff.id,
        invitedByStaffId: staff["a.obi@lavelle.ng"]!.id,
        tokenHash: hashInvitationToken(invitationToken),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    console.log(`[seed] Ngozi Balogun's activation link: http://localhost:3000/api/staff/activate?token=${invitationToken}`);
  }

  const registrar = staff["b.eze@lavelle.ng"]!;
  const academicAdmin = staff["k.balogun@lavelle.ng"]!;
  const faculty = staff["t.nwachukwu@lavelle.ng"]!;
  const supportAgent = staff["h.suleiman@lavelle.ng"]!;

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

  // ── Certifying examination (Slice 06) — README "Reference data": ₦85,000
  // fee, 60% pass mark, 3 hours ──
  // The bank content below is lifted verbatim from the design handoff's
  // own QBANK/EXAM reference arrays (Lavelle Admin.dc.html / Lavelle
  // LMS.dc.html) — the two files describe the same ELR-201 syllabus from
  // the builder's and the candidate's side, cross-referenced here by
  // question text. Two of Module 2's objective questions have no options
  // listed in either mockup; their option text below is original.
  const exam = await prisma.exam.upsert({
    where: { programmeId: elr.id },
    update: {},
    create: {
      programmeId: elr.id,
      status: ExamStatus.PUBLISHED,
      durationMinutes: 180,
      passMarkPercent: 60,
      feeMinor: 8_500_000,
      publishedAt: new Date("2026-06-01"),
      publishedByStaffId: academicAdmin.id,
    },
  });

  const examModules = await prisma.module.findMany({ where: { programmeId: elr.id }, orderBy: { weekNumber: "asc" } });
  const moduleByWeek = new Map(examModules.map((m) => [m.weekNumber, m]));

  type BankObjective = { week: number; prompt: string; marks: number; status: ExamQuestionStatus; options: string[]; correct: number };
  type BankWritten = { week: number; prompt: string; marks: number; status: ExamQuestionStatus; guidance: string; wordLimit: number };

  const BANK_OBJECTIVE: BankObjective[] = [
    {
      week: 1,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "A joint operating agreement is silent on the consequences of a non-operator failing to pay a cash call. Which mechanism most directly protects the operator's position?",
      options: [
        "Forfeiture of the defaulting party's participating interest under the default clause",
        "An application to NUPRC for reallocation of the interest",
        "Suspension of the licence pending resolution",
        "Termination of the underlying lease",
      ],
      correct: 0,
    },
    {
      week: 1,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "Which instrument governs the fiscal terms applicable to deep offshore production following the 2019 amendment?",
      options: [
        "The Petroleum Profits Tax Act alone",
        "The Deep Offshore and Inland Basin Production Sharing Contract Act as amended",
        "The Companies Income Tax Act",
        "The Nigerian Oil and Gas Industry Content Development Act",
      ],
      correct: 1,
    },
    {
      week: 1,
      marks: 3,
      status: ExamQuestionStatus.IN_REVIEW,
      prompt: "Which factor most clearly triggers a decommissioning liability on assignment of an OML interest?",
      options: [
        "The assignee's first declaration of commerciality",
        "Accrued abandonment obligations attaching to existing wells",
        "A change in the operator's corporate ownership",
        "Expiry of the current field development plan",
      ],
      correct: 1,
    },
    {
      week: 2,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "A compliance audit reveals under-reported Nigerian content for two consecutive quarters. What is the appropriate first step in advising the client?",
      options: [
        "Await the regulator's enforcement notice before acting",
        "Prepare a voluntary corrective disclosure with a remediation plan",
        "Restate only the current quarter's return",
        "Suspend all procurement pending review",
      ],
      correct: 1,
    },
    {
      week: 2,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "Which filing obligation follows a change in participating interest under the NUPRC reporting cycle?",
      options: [
        "Notification within the next annual return only",
        "A change-of-interest filing within the reporting cycle in which completion occurs",
        "No filing — only the assignor's tax return need reflect it",
        "A filing only where the change exceeds 50% of the interest",
      ],
      correct: 1,
    },
    {
      week: 2,
      marks: 2,
      status: ExamQuestionStatus.DRAFT,
      prompt: "On what basis may the regulator suspend a field development plan mid-cycle?",
      options: [
        "Only on the operator's own application",
        "Material non-compliance with an approved plan or licence condition",
        "A fall in the international oil price",
        "A change in the operator's registered address",
      ],
      correct: 1,
    },
    {
      week: 3,
      marks: 3,
      status: ExamQuestionStatus.APPROVED,
      prompt: "On a project-financed gas processing facility, what is the primary purpose of a direct agreement with the offtaker?",
      options: [
        "To fix the tariff for the life of the facility",
        "To preserve the offtake contract for lenders on enforcement, via step-in rights",
        "To transfer construction risk to the offtaker",
        "To satisfy local content reporting obligations",
      ],
      correct: 1,
    },
    {
      week: 3,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "Under a PSC, cost oil recovery is best described as?",
      options: [
        "A guaranteed return on the contractor's investment",
        "Recovery of allowable costs from production, ahead of profit-oil sharing",
        "A royalty payable to the State",
        "A tax credit against petroleum profits tax",
      ],
      correct: 1,
    },
    {
      week: 4,
      marks: 2,
      status: ExamQuestionStatus.APPROVED,
      prompt: "An arbitration clause provides for a seat in Lagos under UNCITRAL Rules. Which court has supervisory jurisdiction over the award?",
      options: [
        "The Federal High Court of Nigeria",
        "The courts of the place where the asset is located",
        "The ICSID Secretariat",
        "The Court of Arbitration of the ICC",
      ],
      correct: 0,
    },
    {
      week: 4,
      marks: 2,
      status: ExamQuestionStatus.IN_REVIEW,
      prompt: "Which factor most strongly favours expert determination over arbitration in a metering dispute?",
      options: [
        "The sums in issue are very large",
        "The dispute is narrow, technical, and turns on measurement",
        "One party is a State entity",
        "The contract contains a governing-law clause",
      ],
      correct: 1,
    },
  ];

  const BANK_WRITTEN: BankWritten[] = [
    {
      week: 2,
      marks: 10,
      wordLimit: 200,
      status: ExamQuestionStatus.APPROVED,
      prompt:
        "A compliance audit reveals that Nigerian content reporting has been understated for two consecutive quarters. Set out the steps you would advise the board to take, in order, and explain the reasoning behind that sequence.",
      guidance: "Marks are awarded for the order of steps and the reasoning, not for length. State any assumptions you make.",
    },
    {
      week: 3,
      marks: 15,
      wordLimit: 300,
      status: ExamQuestionStatus.APPROVED,
      prompt:
        "Your client, an indigenous exploration and production company, has been offered a farm-in on a marginal field held under an OML due for renewal in eighteen months. Advise on the regulatory approvals required before completion, and on how the renewal risk should be allocated between the parties.",
      guidance: "Address the consent regime, the decommissioning liability that travels with the interest, and at least one drafting mechanism for allocating renewal risk. Cite the applicable guidelines where you rely on them.",
    },
  ];

  const existingExamQuestions = await prisma.examQuestion.count({ where: { examId: exam.id } });
  if (existingExamQuestions === 0) {
    for (const q of BANK_OBJECTIVE) {
      const mod = moduleByWeek.get(q.week);
      if (!mod) continue;
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          moduleId: mod.id,
          type: ExamQuestionType.OBJECTIVE,
          status: q.status,
          prompt: q.prompt,
          marks: q.marks,
          options: { create: q.options.map((text, i) => ({ orderIndex: i, text, isCorrect: i === q.correct })) },
        },
      });
    }
    for (const q of BANK_WRITTEN) {
      const mod = moduleByWeek.get(q.week);
      if (!mod) continue;
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          moduleId: mod.id,
          type: ExamQuestionType.WRITTEN,
          status: q.status,
          prompt: q.prompt,
          marks: q.marks,
          guidance: q.guidance,
          wordLimit: q.wordLimit,
        },
      });
    }
  }

  // Three monthly windows.
  const examWindowSeeds = [
    { opensAt: new Date("2026-09-14T09:00:00Z"), closesAt: new Date("2026-09-15T09:00:00Z"), registrationDeadline: new Date("2026-09-07T23:59:00Z") },
    { opensAt: new Date("2026-10-12T09:00:00Z"), closesAt: new Date("2026-10-13T09:00:00Z"), registrationDeadline: new Date("2026-10-05T23:59:00Z") },
    { opensAt: new Date("2026-11-16T09:00:00Z"), closesAt: new Date("2026-11-17T09:00:00Z"), registrationDeadline: new Date("2026-11-09T23:59:00Z") },
  ];
  const existingWindows = await prisma.examWindow.count({ where: { examId: exam.id } });
  if (existingWindows === 0) {
    await prisma.examWindow.createMany({ data: examWindowSeeds.map((w) => ({ examId: exam.id, capacity: null, ...w })) });
  }

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

  // Three of these (TLC-201, MAL-201, RCF-101) go ACTIVE with one minimal
  // module+lecture each — just enough to legitimately pass Slice 09's
  // publish checks (ACTIVE, ≥1 module with ≥1 lecture, feeMinor > 0), so
  // the website's four seeded published listings (README: "four
  // published listings matching the seeded programmes") have a real
  // programme behind each rather than a fabricated one. The rest stay
  // DRAFT — a programme with zero modules cannot legitimately be ACTIVE
  // (rule 2) — which also gives the admin publish-checks something real
  // to refuse (CCP-101 demonstrates "programme is DRAFT" live).
  const draftSeeds = [
    {
      code: "TLC-201", title: "Tax Law & Compliance", tier: ProgrammeTier.SPECIALIST, category: "Tax & Revenue", feeMinor: 45_000_000,
      publishable: true,
      summary: "Revenue practice, assessment disputes and advisory work before the tax authorities, taught by practitioners who appear before them.",
    },
    {
      code: "MAL-201", title: "Maritime & Admiralty Law", tier: ProgrammeTier.SPECIALIST, category: "Maritime & Admiralty", feeMinor: 45_000_000,
      publishable: true,
      summary: "Carriage, charterparties, cargo claims and admiralty jurisdiction in Nigerian waters.",
    },
    {
      code: "RCF-101", title: "Regulatory Compliance Foundations", tier: ProgrammeTier.FOUNDATION, category: "Regulatory Compliance", feeMinor: 28_000_000,
      publishable: true,
      summary: "The regulator's framework, filing obligations and the compliance advisory role, for graduates and non-lawyers in regulated industries.",
    },
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
    const publishable = "publishable" in p && p.publishable;
    programmes[p.code] = await prisma.programme.upsert({
      where: { code: p.code },
      // Explicit (not {}): this row may already exist DRAFT from a run
      // before this programme was promoted to publishable — without
      // re-asserting status/summary here, upsert's update:{} would leave
      // a stale DRAFT row in place forever on repeat seeds.
      update: publishable
        ? { status: ProgrammeStatus.ACTIVE, summary: "summary" in p ? p.summary : undefined }
        : {},
      create: {
        code: p.code,
        title: p.title,
        categoryId: categories[p.category]!.id,
        tier: p.tier,
        status: publishable ? ProgrammeStatus.ACTIVE : ProgrammeStatus.DRAFT,
        summary: "summary" in p ? p.summary : `${p.title} — programme details to be completed by faculty.`,
        feeMinor: p.feeMinor,
        prerequisiteTier: "prerequisiteTier" in p ? p.prerequisiteTier : undefined,
        createdByStaffId: academicAdmin.id,
        ...TIER_DEFAULTS[p.tier],
      },
    });
    if (publishable) {
      const mod = await prisma.module.upsert({
        where: { programmeId_weekNumber: { programmeId: programmes[p.code]!.id, weekNumber: 1 } },
        update: {},
        create: { programmeId: programmes[p.code]!.id, weekNumber: 1, title: "Week 1", orderIndex: 0 },
      });
      const existingLecture = await prisma.lecture.findFirst({ where: { moduleId: mod.id } });
      if (!existingLecture) {
        await prisma.lecture.create({
          data: { moduleId: mod.id, orderIndex: 0, title: "Introduction", mediaKind: LectureMediaKind.SLIDES },
        });
      }
      // These three have no certifying Exam record (only ELR-201 does) —
      // weight just Quiz + Drafting, the two assessments they actually have.
      // Clear any stale EXAMINATION row from an earlier seed run so a
      // re-seed doesn't leave weights totalling more than 100%.
      await prisma.assessmentWeighting.deleteMany({
        where: { programmeId: programmes[p.code]!.id, kind: AssessmentKind.EXAMINATION },
      });
      for (const [kind, weightPercent] of [
        [AssessmentKind.QUIZ, 40],
        [AssessmentKind.DRAFTING, 60],
      ] as const) {
        await prisma.assessmentWeighting.upsert({
          where: { programmeId_kind: { programmeId: programmes[p.code]!.id, kind } },
          update: { weightPercent },
          create: { programmeId: programmes[p.code]!.id, kind, weightPercent },
        });
      }
    }
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
  const existingChiamakaCard = await prisma.idCard.findFirst({ where: { candidateId: chiamaka.id, retiredAt: null } });
  if (!existingChiamakaCard) {
    await prisma.idCard.create({
      data: {
        candidateId: chiamaka.id,
        cardNumber: "LVL/2026/00291",
        tier: ProgrammeTier.SPECIALIST,
        issuedAt: new Date("2026-07-02T09:11:00Z"),
        validUntil: new Date("2027-12-31"),
      },
    });
  }

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
  const ngoziAdeleke = await prisma.candidate.upsert({
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

  // ── Certificate template ──
  // A placeholder artwork asset — no real file is written for it (same
  // precedent as the rest of this seed script: no MediaAsset row here is
  // backed by real bytes on disk). The PDF renderer draws the certificate
  // with pdf-lib's own vector primitives rather than embedding this image,
  // so nothing downstream needs it to resolve to a real file.
  const certificateArtwork = await prisma.mediaAsset.upsert({
    where: { storageKey: "seed/certificate-artwork-2026.png" },
    update: {},
    create: {
      kind: "image",
      storageKey: `seed/certificate-artwork-2026.png`,
      mimeType: "image/png",
      bytes: 428_112,
      originalFilename: "lavelle-certificate-artwork-2026.png",
      uploadedByStaffId: academicAdmin.id,
    },
  });
  const certificateTemplate = await prisma.certificateTemplate.upsert({
    where: { id: "seed-certificate-template-2026" },
    update: {},
    create: {
      id: "seed-certificate-template-2026",
      name: "Lavelle certificate — 2026 revision",
      artworkAssetId: certificateArtwork.id,
      appliesToTier: null,
      signatoryBlock: "Registrar · Dean of Faculty",
      printedFields: {
        name: true,
        programmeAndTier: true,
        band: true,
        certificateIdAndQr: true,
        pathwayMark: true,
        issueDate: true,
      },
      isActive: true,
      activatedAt: new Date("2026-01-01"),
      createdByStaffId: academicAdmin.id,
    },
  });

  // ── Certificates — Handoff 00's verify-portal register, extended to
  // exercise all three verification outcomes (README: "one active
  // certificate, one revoked with a successor, and one superseded").
  // Manually issued (sittingId null) — these predate Slice 06's exam
  // pipeline, exactly the "edge case" manual issue exists for.
  const activePdfAssetId = await seedCertificatePdf({
    certificateNumber: "LVL-CERT-2025-00790",
    holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
    programmeTitle: programmes["FCE-101"]!.title,
    tier: ProgrammeTier.FOUNDATION,
    band: GradeBand.DISTINCTION,
    pathway: "EXAMINATION_ONLY",
    issuedAt: new Date("2025-12-09"),
    signatoryBlock: certificateTemplate.signatoryBlock,
    staffId: academicAdmin.id,
  });
  await prisma.certificate.upsert({
    where: { certificateNumber: "LVL-CERT-2025-00790" },
    update: { pdfAssetId: activePdfAssetId },
    create: {
      certificateNumber: "LVL-CERT-2025-00790",
      candidateId: chiamaka.id,
      programmeId: programmes["FCE-101"]!.id,
      enrolmentId: null,
      pathway: CredentialPathway.EXAMINATION_ONLY,
      holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
      candidateNumber: chiamaka.candidateNumber,
      programmeTitle: programmes["FCE-101"]!.title,
      tier: ProgrammeTier.FOUNDATION,
      finalPercent: 82,
      band: GradeBand.DISTINCTION,
      status: CertificateStatus.ACTIVE,
      issuedAt: new Date("2025-12-09"),
      issuedByStaffId: academicAdmin.id,
      templateId: certificateTemplate.id,
      pdfAssetId: activePdfAssetId,
    },
  });

  // A three-link chain on the same programme: issued with the wrong
  // programme title recorded (SUPERSEDED — never invalid, corrected), the
  // correction was later REVOKED for an integrity finding, and the
  // appeal was upheld, producing a fresh ACTIVE certificate. Demonstrates
  // rule 6/7's distinction: superseded and revoked are different states,
  // and a revoked certificate can itself be re-issued.
  const supersededPdfAssetId = await seedCertificatePdf({
    certificateNumber: "LVL-CERT-2025-00219",
    holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
    programmeTitle: "Introduction to Regulatory Practise",
    tier: ProgrammeTier.FOUNDATION,
    band: GradeBand.MERIT,
    pathway: "EXAMINATION_ONLY",
    issuedAt: new Date("2025-11-08"),
    signatoryBlock: certificateTemplate.signatoryBlock,
    staffId: academicAdmin.id,
  });
  const superseded = await prisma.certificate.upsert({
    where: { certificateNumber: "LVL-CERT-2025-00219" },
    update: { pdfAssetId: supersededPdfAssetId },
    create: {
      certificateNumber: "LVL-CERT-2025-00219",
      candidateId: chiamaka.id,
      programmeId: programmes["IRP-101"]!.id,
      enrolmentId: null,
      pathway: CredentialPathway.EXAMINATION_ONLY,
      holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
      candidateNumber: chiamaka.candidateNumber,
      programmeTitle: "Introduction to Regulatory Practise", // the misspelling that was corrected
      tier: ProgrammeTier.FOUNDATION,
      finalPercent: 64,
      band: GradeBand.MERIT,
      status: CertificateStatus.SUPERSEDED,
      issuedAt: new Date("2025-11-08"),
      issuedByStaffId: academicAdmin.id,
      templateId: certificateTemplate.id,
      pdfAssetId: supersededPdfAssetId,
    },
  });
  const revokedPdfAssetId = await seedCertificatePdf({
    certificateNumber: "LVL-CERT-2025-00655",
    holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
    programmeTitle: programmes["IRP-101"]!.title,
    tier: ProgrammeTier.FOUNDATION,
    band: GradeBand.MERIT,
    pathway: "EXAMINATION_ONLY",
    issuedAt: new Date("2025-11-12"),
    signatoryBlock: certificateTemplate.signatoryBlock,
    staffId: academicAdmin.id,
  });
  const revoked = await prisma.certificate.upsert({
    where: { certificateNumber: "LVL-CERT-2025-00655" },
    update: { pdfAssetId: revokedPdfAssetId },
    create: {
      certificateNumber: "LVL-CERT-2025-00655",
      candidateId: chiamaka.id,
      programmeId: programmes["IRP-101"]!.id,
      enrolmentId: null,
      pathway: CredentialPathway.EXAMINATION_ONLY,
      holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
      candidateNumber: chiamaka.candidateNumber,
      programmeTitle: programmes["IRP-101"]!.title,
      tier: ProgrammeTier.FOUNDATION,
      finalPercent: 64,
      band: GradeBand.MERIT,
      status: CertificateStatus.REVOKED,
      revokedReason: "Assessment integrity finding of the examinations panel",
      revokedAt: new Date("2025-11-19"),
      issuedAt: new Date("2025-11-12"),
      issuedByStaffId: academicAdmin.id,
      templateId: certificateTemplate.id,
      replacesId: superseded.id,
      pdfAssetId: revokedPdfAssetId,
    },
  });
  await prisma.certificate.update({ where: { id: superseded.id }, data: { supersededById: revoked.id } });

  const reissuedPdfAssetId = await seedCertificatePdf({
    certificateNumber: "LVL-CERT-2026-01188",
    holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
    programmeTitle: programmes["IRP-101"]!.title,
    tier: ProgrammeTier.FOUNDATION,
    band: GradeBand.MERIT,
    pathway: "EXAMINATION_ONLY",
    issuedAt: new Date("2026-08-04"),
    signatoryBlock: certificateTemplate.signatoryBlock,
    staffId: academicAdmin.id,
  });
  const reissued = await prisma.certificate.upsert({
    where: { certificateNumber: "LVL-CERT-2026-01188" },
    update: { pdfAssetId: reissuedPdfAssetId },
    create: {
      certificateNumber: "LVL-CERT-2026-01188",
      candidateId: chiamaka.id,
      programmeId: programmes["IRP-101"]!.id,
      enrolmentId: null,
      pathway: CredentialPathway.EXAMINATION_ONLY,
      holderName: `${chiamaka.firstName} ${chiamaka.lastName}`,
      candidateNumber: chiamaka.candidateNumber,
      programmeTitle: programmes["IRP-101"]!.title,
      tier: ProgrammeTier.FOUNDATION,
      finalPercent: 64,
      band: GradeBand.MERIT,
      status: CertificateStatus.ACTIVE,
      issuedAt: new Date("2026-08-04"),
      issuedByStaffId: academicAdmin.id,
      templateId: certificateTemplate.id,
      replacesId: revoked.id,
      pdfAssetId: reissuedPdfAssetId,
    },
  });
  await prisma.certificate.update({ where: { id: revoked.id }, data: { supersededById: reissued.id } });

  // ── Slice 08: support desk, notes, announcements ────────────────────
  // Guarded on an existing-rows check (like GradeBandDefinition above) —
  // these have no natural unique key to upsert against.
  const existingSupportRequests = await prisma.supportRequest.count();
  if (existingSupportRequests === 0) {
    await prisma.supportRequest.create({
      data: {
        candidateId: chiamaka.id,
        subject: "Certificate shows my maiden name",
        category: RequestCategory.OTHER,
        body: "My certificate for IRP-101 has my maiden name on it — I updated my profile to my married name before the exam. Can this be corrected?",
        status: "OPEN",
      },
    });

    const inProgress = await prisma.supportRequest.create({
      data: {
        candidateId: ngoziAdeleke.id,
        subject: "Payment not reflecting on my account",
        category: RequestCategory.PAYMENT,
        body: "I paid the ELR-201 fee via bank transfer three days ago but my dashboard still shows the programme as not enrolled.",
        status: "IN_PROGRESS",
        assignedStaffId: registrar.id,
        firstRespondedAt: new Date("2026-08-05T10:00:00Z"),
      },
    });
    await prisma.supportMessage.create({
      data: {
        requestId: inProgress.id,
        authorCandidateId: ngoziAdeleke.id,
        body: "I paid the ELR-201 fee via bank transfer three days ago but my dashboard still shows the programme as not enrolled.",
        createdAt: new Date("2026-08-04T09:00:00Z"),
      },
    });
    await prisma.supportMessage.create({
      data: {
        requestId: inProgress.id,
        authorStaffId: registrar.id,
        body: "Thanks for flagging this — I can see the transfer landed but wasn't matched automatically. Confirming manually now, you should see it reflected within the hour.",
        createdAt: new Date("2026-08-05T10:00:00Z"),
      },
    });

    const resolved = await prisma.supportRequest.create({
      data: {
        candidateId: chiamaka.id,
        subject: "How do I download my ID card?",
        category: RequestCategory.TECHNICAL,
        body: "Where on the dashboard can I find my candidate ID card?",
        status: "RESOLVED",
        assignedStaffId: supportAgent.id,
        firstRespondedAt: new Date("2026-07-20T14:00:00Z"),
        resolvedAt: new Date("2026-07-20T14:15:00Z"),
      },
    });
    await prisma.supportMessage.create({
      data: {
        requestId: resolved.id,
        authorCandidateId: chiamaka.id,
        body: "Where on the dashboard can I find my candidate ID card?",
        createdAt: new Date("2026-07-20T13:50:00Z"),
      },
    });
    await prisma.supportMessage.create({
      data: {
        requestId: resolved.id,
        authorStaffId: supportAgent.id,
        body: "It's under Dashboard > My Enrolment > ID Card — you can download a PDF from there.",
        createdAt: new Date("2026-07-20T14:15:00Z"),
      },
    });
  }

  const existingNotes = await prisma.candidateNote.count();
  if (existingNotes === 0) {
    await prisma.candidateNote.create({
      data: {
        candidateId: chiamaka.id,
        authorStaffId: registrar.id,
        body: "Confirmed by phone that the certificate name correction is a legitimate request — marriage certificate sighted.",
      },
    });
  }

  const existingAnnouncements = await prisma.announcement.count();
  if (existingAnnouncements === 0) {
    const announcement = await prisma.announcement.create({
      data: {
        title: "September 2026 intake now open",
        body: "Applications for the September 2026 intake are now open across all Foundation and Advanced tier programmes. Early enrolment closes 31 August.",
        audienceFilter: { status: "ENROLLED" },
        channels: ["IN_APP", "EMAIL"],
        state: "SENT",
        sentAt: new Date("2026-08-01T09:00:00Z"),
        recipientCount: 1,
        createdByStaffId: registrar.id,
      },
    });
    await prisma.announcementDelivery.createMany({
      data: [
        { announcementId: announcement.id, candidateId: chiamaka.id, channel: "IN_APP", deliveredAt: new Date("2026-08-01T09:00:01Z") },
        { announcementId: announcement.id, candidateId: chiamaka.id, channel: "EMAIL", deliveredAt: new Date("2026-08-01T09:00:05Z") },
      ],
    });
  }

  // ── Slice 09: public website & publishing ───────────────────────────
  const PUBLISHED_CODES = ["ELR-201", "TLC-201", "MAL-201", "RCF-101"] as const;
  for (const [i, code] of PUBLISHED_CODES.entries()) {
    const programme = programmes[code]!;
    await prisma.programmeListing.upsert({
      where: { programmeId: programme.id },
      update: {},
      create: {
        programmeId: programme.id,
        isPublished: true,
        useDefaults: true, // renders from the live Programme row — a fee change reaches the site with no republish
        orderIndex: i,
        publishedAt: new Date("2026-08-01T09:00:00Z"),
        publishedByStaffId: registrar.id,
      },
    });
  }
  // CCP-101 and AEP-301 stay unlisted — no ProgrammeListing row at all,
  // so listListings shows them as "Not published" with nothing to unpublish.

  const existingReviews = await prisma.review.count();
  if (existingReviews === 0) {
    await prisma.review.createMany({
      data: [
        {
          authorName: "Adaeze Okonkwo", authorTitle: "Partner, commercial disputes · Lagos",
          programmeId: programmes["ELR-201"]!.id, rating: 5, orderIndex: 0, state: "PUBLISHED",
          quote: "Two operators now brief me directly on joint venture disputes. The drafting exercises were the difference. I was marked on the same standard my opponents work to.",
        },
        {
          authorName: "Ibrahim Bello", authorTitle: "Senior associate · Abuja",
          programmeId: programmes["TLC-201"]!.id, rating: 5, orderIndex: 1, state: "PUBLISHED",
          quote: "My first drafting submission came back referred with three pages of notes. Bruising, and exactly what I needed. The second one passed on merit.",
        },
        {
          authorName: "Funmi Nwachukwu", authorTitle: "In-house counsel, banking · Lagos",
          programmeId: programmes["RCF-101"]!.id, rating: 5, orderIndex: 2, state: "PUBLISHED",
          quote: "Six hours a week, mostly evenings, and nothing was padded. I never once felt I was watching a recording to tick a box.",
        },
      ],
    });
  }

  const existingFaqs = await prisma.faqEntry.count();
  if (existingFaqs === 0) {
    // Order is explicit and fixed (README): pay-to-register first, the
    // prerequisite question deliberately last.
    await prisma.faqEntry.createMany({
      data: [
        {
          orderIndex: 0, isPublished: true,
          question: "Do I need to pay to register?",
          answer: "No. Registration is free. You can register and explore every programme in full, then pay only for the specialisation you choose to begin. The certifying examination fee is charged separately, and only when you register for a sitting.",
        },
        {
          orderIndex: 1, isPublished: true,
          question: "How much time does a programme take?",
          answer: "Twelve weeks at six to eight hours a week, delivered online. Lectures are recorded with narration so you set your own pace, but drafting exercises carry submission deadlines and the examination sits in a fixed window.",
        },
        {
          orderIndex: 2, isPublished: true,
          question: "Can an employer or client verify my credential?",
          answer: "Yes, and without contacting us. Every certificate carries an identifier checkable on our public verification portal, which returns the holder, programme, tier, grade and issue date, and clearly shows a credential that has been revoked or superseded.",
        },
        {
          orderIndex: 3, isPublished: true,
          question: "I am not yet called to the Bar. Can I enrol?",
          answer: "Yes. Law graduates and students may take Foundation programmes, and non-lawyers working in regulated industries are welcome on the compliance pathways. Your professional status is recorded so your credential reflects your standing accurately.",
        },
        {
          orderIndex: 4, isPublished: true,
          question: "Do I need to complete a programme before sitting an examination?",
          answer: "At Foundation and Specialist level, no. You may register for an examination directly. At Advanced Practitioner level a completed programme at the tier below is a prerequisite. Candidates who complete the programme carry a Lavelle pathway credential, which records both the study and the examination.",
        },
      ],
    });
  }

  // ── Slice 11 fixtures ──
  //
  // Sittings, conduct review and review-moderation examples — none of
  // Slice 06's seed data ever produced an actual Sitting row, so the
  // invigilation and review screens had nothing to show.
  const superAdmin = await prisma.staff.findUniqueOrThrow({ where: { email: "a.obi@lavelle.ng" } });
  const sepWindow = await prisma.examWindow.findFirstOrThrow({ where: { examId: exam.id }, orderBy: { opensAt: "asc" } });
  const sepCohort = await prisma.cohort.findUniqueOrThrow({ where: { code: "SPEC-ENR-03" } });
  const sepIntake = await prisma.intake.findUniqueOrThrow({ where: { month_year: { month: IntakeMonth.SEPTEMBER, year: 2026 } } });

  async function seedCompletedCandidate(input: {
    email: string; applicantNumber: string; candidateNumber: string; firstName: string; lastName: string;
  }) {
    const candidate = await prisma.candidate.upsert({
      where: { email: input.email },
      update: {},
      create: {
        applicantNumber: input.applicantNumber,
        candidateNumber: input.candidateNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        acceptedTermsAt: new Date("2026-01-05"),
        emailVerifiedAt: new Date("2026-01-05"),
        profile: { create: { professionalStatus: ProfessionalStatus.PRACTISING_LAWYER, yearOfCall: 2018, handbookAcknowledgedAt: new Date("2026-01-05"), completedAt: new Date("2026-01-05") } },
        enrolments: {
          create: {
            programmeId: elr.id,
            cohortId: sepCohort.id,
            intakeId: sepIntake.id,
            status: "COMPLETED",
            enrolledAt: new Date("2026-01-14"),
            completedAt: new Date("2026-08-01"),
          },
        },
      },
      include: { enrolments: true },
    });
    return { candidate, enrolment: candidate.enrolments[0]! };
  }

  const { candidate: tolu, enrolment: toluEnrolment } = await seedCompletedCandidate({
    email: "t.fashola@chambers.ng", applicantNumber: "LVL-APP-2026-05512", candidateNumber: "LVL/2026/00318", firstName: "Tolu", lastName: "Fashola",
  });
  const { candidate: emeka } = await seedCompletedCandidate({
    email: "e.obiora@chambers.ng", applicantNumber: "LVL-APP-2026-05519", candidateNumber: "LVL/2026/00319", firstName: "Emeka", lastName: "Obiora",
  });

  async function seedSitting(candidateId: string, opts: { flagged: boolean; conductReview: "PENDING" | "REFERRED" }) {
    // No compound-unique on (candidateId, examId) to upsert against —
    // guard with an existence check instead.
    let registration = await prisma.examRegistration.findFirst({ where: { candidateId, examId: exam.id } });
    if (!registration) {
      registration = await prisma.examRegistration.create({
        data: { candidateId, examId: exam.id, windowId: sepWindow.id, registeredAt: new Date("2026-08-01T09:00:00Z") },
      });
    }
    const startedAt = new Date("2026-09-14T09:05:00Z");
    const submittedAt = new Date("2026-09-14T11:58:00Z");
    const existing = await prisma.sitting.findUnique({ where: { registrationId: registration.id } });
    if (existing) return existing;
    const sitting = await prisma.sitting.create({
      data: {
        registrationId: registration.id,
        state: "SUBMITTED",
        startedAt,
        expiresAt: new Date("2026-09-14T12:05:00Z"),
        submittedAt,
        objectivePercent: 78,
        totalPercent: 78,
        outcome: "PASS",
        band: GradeBand.MERIT,
        conductReview: opts.conductReview,
        invigilatorFinding: opts.conductReview === "REFERRED" ? "Four full-screen exits in the final twenty minutes, two immediately after the written question loaded. Pattern is consistent with reference material off-screen — referring for the panel's view of the written answer." : null,
        reviewedByStaffId: opts.conductReview === "REFERRED" ? superAdmin.id : null,
        reviewedAt: opts.conductReview === "REFERRED" ? new Date("2026-09-15T10:00:00Z") : null,
        referredAt: opts.conductReview === "REFERRED" ? new Date("2026-09-15T10:00:00Z") : null,
      },
    });
    if (opts.flagged) {
      await prisma.proctoringEvent.createMany({
        data: [
          { sittingId: sitting.id, kind: "tab_switch", occurredAt: new Date("2026-09-14T09:18:00Z") },
          { sittingId: sitting.id, kind: "fullscreen_exit", occurredAt: new Date("2026-09-14T11:40:00Z") },
          ...(opts.conductReview === "REFERRED"
            ? [
                { sittingId: sitting.id, kind: "fullscreen_exit", occurredAt: new Date("2026-09-14T11:44:00Z") },
                { sittingId: sitting.id, kind: "fullscreen_exit", occurredAt: new Date("2026-09-14T11:46:00Z") },
              ]
            : []),
        ],
      });
    }
    return sitting;
  }

  await seedSitting(tolu.id, { flagged: true, conductReview: "PENDING" });
  await seedSitting(emeka.id, { flagged: true, conductReview: "REFERRED" });

  // Review moderation queue — one awaiting, one declined (the candidate is
  // never told why, per rule 7; the reason stays internal).
  const existingSlice11Reviews = await prisma.review.count({ where: { candidateId: { not: null } } });
  if (existingSlice11Reviews === 0) {
    await prisma.review.create({
      data: {
        candidateId: tolu.id, enrolmentId: toluEnrolment.id, programmeId: elr.id,
        authorName: "Tolu Fashola", authorTitle: "Associate, energy practice · Lagos",
        quote: "The drafting exercises were harder than anything in my day job. Worth every week.",
        rating: 5, state: "PENDING",
      },
    });
    await prisma.review.create({
      data: {
        candidateId: emeka.id, programmeId: elr.id,
        authorName: "Emeka Obiora", authorTitle: "In-house counsel · Abuja",
        quote: "Fine programme but the marking turnaround was slower than I expected some weeks.",
        rating: 3, state: "DECLINED", declineReason: "Names a specific marking-turnaround complaint we're addressing directly with the candidate — publishing it reads as an unresolved institutional issue rather than a review.",
        moderatedByStaffId: superAdmin.id, moderatedAt: new Date("2026-08-05T10:00:00Z"),
      },
    });
  }

  // A suspended staff member — distinct from the deactivated ones Slice 10
  // already seeds, to exercise Part G's own status and dialog.
  await prisma.staff.upsert({
    where: { email: "y.coker@lavelle.ng" },
    update: {},
    create: {
      name: "Yewande Coker", email: "y.coker@lavelle.ng", role: StaffRole.SUPPORT, status: StaffStatus.SUSPENDED,
      passwordHash, activatedAt: new Date("2026-06-01"),
      suspendedAt: new Date("2026-08-04T09:00:00Z"), suspendedReason: "Extended leave — returning 1 September.", suspendedByStaffId: superAdmin.id,
      permissionGrants: { create: ROLE_PRESETS[StaffRole.SUPPORT].map((permission) => ({ permission, grantedByStaffId: superAdmin.id })) },
    },
  });

  // An archived programme whose listing is still live — Part C's derived
  // admin warning has nothing to show without this.
  if (programmes["MAL-201"]) {
    await prisma.programme.update({ where: { id: programmes["MAL-201"]!.id }, data: { status: "ARCHIVED" } });
  }

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
