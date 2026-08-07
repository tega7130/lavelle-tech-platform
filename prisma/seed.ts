// Seed data lifted from the design handoff's "Reference data used in the
// prototypes" section — fictional, but exact where the README gives exact
// values (identifiers, fees, dates). Run via `npx prisma migrate dev`
// (auto-seeds) or `npx prisma db seed`.
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, StaffRole, ProgrammeTier, ProgrammeStatus, IntakeType, Grade, CertificateStatus, ProfessionalStatus, ExperienceBand } from "../src/generated/prisma/client";
import { ROLE_PRESETS } from "../src/lib/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Lavelle2026!";

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD);

  // ── Intakes — Jan/Apr are seeded for catalogue completeness, unused elsewhere here ──
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

  // ── Programmes — README "Reference data" catalogue ──
  const programmeSeeds = [
    { code: "ELR-201", title: "Energy Law & Regulation", tier: ProgrammeTier.SPECIALIST, category: "Energy & Natural Resources", feeNaira: 450000, status: ProgrammeStatus.LIVE },
    { code: "TLC-201", title: "Tax Law & Compliance", tier: ProgrammeTier.SPECIALIST, category: "Tax & Regulatory", feeNaira: 450000, status: ProgrammeStatus.LIVE },
    { code: "MAL-201", title: "Maritime & Admiralty Law", tier: ProgrammeTier.SPECIALIST, category: "Maritime & Admiralty", feeNaira: 450000, status: ProgrammeStatus.LIVE },
    { code: "RCF-101", title: "Regulatory Compliance Foundations", tier: ProgrammeTier.FOUNDATION, category: "Regulatory Practice", feeNaira: 280000, status: ProgrammeStatus.LIVE },
    { code: "CCP-101", title: "Corporate & Commercial Practice", tier: ProgrammeTier.FOUNDATION, category: "Corporate & Commercial", feeNaira: 280000, status: ProgrammeStatus.DRAFT },
    { code: "AEP-301", title: "Advanced Energy Practice", tier: ProgrammeTier.ADVANCED_PRACTITIONER, category: "Energy & Natural Resources", feeNaira: 680000, status: ProgrammeStatus.DRAFT },
    // Back the Verify-portal sample register faithfully (README "verify" reference data).
    { code: "FCE-101", title: "Foundation Certificate in Energy Law", tier: ProgrammeTier.FOUNDATION, category: "Energy & Natural Resources", feeNaira: 280000, status: ProgrammeStatus.LIVE },
    { code: "IRP-101", title: "Introduction to Regulatory Practice", tier: ProgrammeTier.FOUNDATION, category: "Regulatory Practice", feeNaira: 280000, status: ProgrammeStatus.LIVE },
  ] as const;

  const TIER_DEFAULTS = {
    [ProgrammeTier.FOUNDATION]: { lengthWeeks: 8, credits: 12, weeklyCommitmentHours: 6 },
    [ProgrammeTier.SPECIALIST]: { lengthWeeks: 12, credits: 24, weeklyCommitmentHours: 8 },
    [ProgrammeTier.ADVANCED_PRACTITIONER]: { lengthWeeks: 16, credits: 36, weeklyCommitmentHours: 10 },
  };

  const programmes: Record<string, Awaited<ReturnType<typeof prisma.programme.upsert>>> = {};
  for (const p of programmeSeeds) {
    const defaults = TIER_DEFAULTS[p.tier];
    programmes[p.code] = await prisma.programme.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, ...defaults },
    });
  }

  // Examination — README "Reference data": ₦85,000 fee, 60% pass mark, 3 hours, proctored/remote.
  await prisma.examination.upsert({
    where: { programmeId: programmes["ELR-201"].id },
    update: {},
    create: {
      programmeId: programmes["ELR-201"].id,
      feeNaira: 85000,
      durationMinutes: 180,
      passMarkPct: 60,
      proctored: true,
      remote: true,
      published: true,
    },
  });

  // A cohort for the flagship live programme, September 2026 intake.
  const cohort = await prisma.cohort.upsert({
    where: {
      programmeId_intakeId_label: {
        programmeId: programmes["ELR-201"].id,
        intakeId: sep26.id,
        label: "ELR-201 · Sep 2026",
      },
    },
    update: {},
    create: { programmeId: programmes["ELR-201"].id, intakeId: sep26.id, label: "ELR-201 · Sep 2026" },
  });

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
          programmeId: programmes["ELR-201"].id,
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

  // ── Certificates — README verify-portal register, faithfully reproduced ──
  await prisma.certificate.upsert({
    where: { identifier: "LVL-CERT-2025-00790" },
    update: {},
    create: {
      identifier: "LVL-CERT-2025-00790",
      candidateId: chiamaka.id,
      programmeId: programmes["FCE-101"].id,
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
      programmeId: programmes["IRP-101"].id,
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
      programmeId: programmes["IRP-101"].id,
      tier: ProgrammeTier.FOUNDATION,
      grade: Grade.MERIT,
      issuedAt: new Date("2026-08-04"),
      status: CertificateStatus.ACTIVE,
      replacesCertificateId: revoked.id,
    },
  });

  // ── Staff — one per role, per README's "Roles and their colours" table ──
  const staffSeeds = [
    { email: "a.obi@lavelle.ng", name: "Adaeze Obi", jobTitle: "Registrar", department: "Institution", role: StaffRole.SUPER_ADMIN },
    { email: "b.eze@lavelle.ng", name: "Bassey Eze", jobTitle: "Operations Manager", department: "Operations", role: StaffRole.OPERATIONS_ADMIN },
    { email: "f.udo@lavelle.ng", name: "Funmi Udo", jobTitle: "Finance Officer", department: "Finance", role: StaffRole.FINANCE_ADMIN },
    { email: "k.balogun@lavelle.ng", name: "Kemi Balogun", jobTitle: "Academic Coordinator", department: "Academic", role: StaffRole.ACADEMIC_ADMIN },
    { email: "t.nwachukwu@lavelle.ng", name: "Tunde Nwachukwu", jobTitle: "Faculty — Energy Law", department: "Faculty", role: StaffRole.FACULTY },
    { email: "h.suleiman@lavelle.ng", name: "Hauwa Suleiman", jobTitle: "Support Agent", department: "Support", role: StaffRole.SUPPORT_AGENT },
  ] as const;

  for (const s of staffSeeds) {
    const staff = await prisma.staff.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, passwordHash },
    });
    // Seed each staff member's permission set from their role's preset —
    // matches applyRolePreset's "replaces the current set" semantics.
    await prisma.permissionGrant.deleteMany({ where: { staffId: staff.id } });
    await prisma.permissionGrant.createMany({
      data: ROLE_PRESETS[s.role].map((permission) => ({ staffId: staff.id, permission, granted: true })),
    });
  }

  console.log(`Seeded. Demo password for every account: ${DEMO_PASSWORD}`);
  console.log("Candidate login: c.okonji@chambers.ng (enrolled) · i.danjuma@example.com (applicant)");
  console.log("Staff login: a.obi@lavelle.ng (Super Admin) · see prisma/seed.ts for the rest");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
