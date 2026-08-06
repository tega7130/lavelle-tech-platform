-- CreateEnum
CREATE TYPE "ProfessionalStatus" AS ENUM ('PRACTISING_LAWYER', 'IN_HOUSE_COUNSEL', 'LAW_GRADUATE', 'LAW_STUDENT', 'NON_LAWYER_REGULATED', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateAccountStatus" AS ENUM ('APPLICANT', 'ENROLLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'FACULTY', 'SUPPORT_AGENT');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW_CANDIDATES', 'EDIT_CANDIDATES', 'VIEW_CONTACT_REQUESTS', 'RESOLVE_CONTACT_REQUESTS', 'ADD_ADMIN_NOTES', 'VIEW_PAYMENTS', 'MANAGE_PAYMENTS', 'VIEW_GRADES', 'GRADE_ASSESSMENTS', 'MANAGE_PROGRAMMES', 'MANAGE_INTAKES', 'ISSUE_CERTIFICATES', 'REVOKE_CERTIFICATES', 'VIEW_AUDIT_LOG', 'EXPORT_DATA', 'MANAGE_STAFF', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ProgrammeTier" AS ENUM ('FOUNDATION', 'SPECIALIST', 'ADVANCED_PRACTITIONER');

-- CreateEnum
CREATE TYPE "ProgrammeStatus" AS ENUM ('DRAFT', 'LIVE');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "LectureMedia" AS ENUM ('SLIDES', 'VIDEO');

-- CreateEnum
CREATE TYPE "NarrationMode" AS ENUM ('PER_SLIDE', 'SINGLE_TRACK');

-- CreateEnum
CREATE TYPE "IntakeType" AS ENUM ('JANUARY', 'APRIL', 'SEPTEMBER');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PENDING_PAYMENT', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('PROGRAMME', 'EXAMINATION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'PENDING', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'THEORY');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('STANDARD', 'TESTING', 'ADVANCED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SittingStatus" AS ENUM ('REGISTERED', 'SAT', 'PASSED', 'REFERRED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('DISTINCTION', 'MERIT', 'PASS', 'REFER');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "provisionalApplicantNumber" TEXT NOT NULL,
    "candidateNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "professionalStatus" "ProfessionalStatus",
    "yearOfCall" INTEGER,
    "scn" TEXT,
    "experienceBand" TEXT,
    "placeOfPractice" TEXT,
    "accountStatus" "CandidateAccountStatus" NOT NULL DEFAULT 'APPLICANT',
    "suspendedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "reactivatedAt" TIMESTAMP(3),
    "reactivationAcknowledgedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "lineManagerId" TEXT,
    "role" "StaffRole" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tier" "ProgrammeTier" NOT NULL,
    "category" TEXT NOT NULL,
    "lengthWeeks" INTEGER NOT NULL,
    "weeklyCommitmentHours" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "feeNaira" DECIMAL(12,2) NOT NULL,
    "status" "ProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "questionDrawCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "media" "LectureMedia" NOT NULL,
    "mediaUrl" TEXT,
    "narrationMode" "NarrationMode" NOT NULL DEFAULT 'PER_SLIDE',
    "narrationAutoAdvance" BOOLEAN NOT NULL DEFAULT true,
    "narrationDurationSecs" INTEGER,
    "hasScenario" BOOLEAN NOT NULL DEFAULT false,
    "hasDraftingExercise" BOOLEAN NOT NULL DEFAULT false,
    "hasQuiz" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "IntakeType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrolment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "cohortId" TEXT,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "enrolledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "programmeId" TEXT,
    "examinationSittingId" TEXT,
    "amountNaira" DECIMAL(12,2) NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "difficulty" "QuestionDifficulty",
    "minWords" INTEGER,
    "guidance" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "feeNaira" DECIMAL(12,2) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "passMarkPct" INTEGER NOT NULL DEFAULT 60,
    "attemptsPolicy" TEXT NOT NULL DEFAULT 'One resit on referral',
    "proctored" BOOLEAN NOT NULL DEFAULT true,
    "remote" BOOLEAN NOT NULL DEFAULT true,
    "fullscreenRequired" BOOLEAN NOT NULL DEFAULT true,
    "tabSwitchWarning" BOOLEAN NOT NULL DEFAULT true,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "reviewAllowed" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationSitting" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "status" "SittingStatus" NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "satAt" TIMESTAMP(3),
    "finalScorePct" DECIMAL(5,2),
    "grade" "Grade",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationSitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "tier" "ProgrammeTier" NOT NULL,
    "grade" "Grade" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByStaffId" TEXT,
    "replacesCertificateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedByStaffId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "actorStaffId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_provisionalApplicantNumber_key" ON "Candidate"("provisionalApplicantNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_candidateNumber_key" ON "Candidate"("candidateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_accountStatus_idx" ON "Candidate"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_role_idx" ON "Staff"("role");

-- CreateIndex
CREATE INDEX "Staff_status_idx" ON "Staff"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionGrant_staffId_permission_key" ON "PermissionGrant"("staffId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_code_key" ON "Programme"("code");

-- CreateIndex
CREATE INDEX "Programme_status_idx" ON "Programme"("status");

-- CreateIndex
CREATE INDEX "Programme_tier_idx" ON "Programme"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Module_programmeId_weekNumber_key" ON "Module"("programmeId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Intake_type_startDate_key" ON "Intake"("type", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_programmeId_intakeId_label_key" ON "Cohort"("programmeId", "intakeId", "label");

-- CreateIndex
CREATE INDEX "Enrolment_candidateId_idx" ON "Enrolment"("candidateId");

-- CreateIndex
CREATE INDEX "Enrolment_programmeId_idx" ON "Enrolment"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_candidateId_idx" ON "Payment"("candidateId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Question_moduleId_status_idx" ON "Question"("moduleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Examination_programmeId_key" ON "Examination"("programmeId");

-- CreateIndex
CREATE INDEX "ExaminationSitting_candidateId_idx" ON "ExaminationSitting"("candidateId");

-- CreateIndex
CREATE INDEX "ExaminationSitting_status_idx" ON "ExaminationSitting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_identifier_key" ON "Certificate"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_replacesCertificateId_key" ON "Certificate"("replacesCertificateId");

-- CreateIndex
CREATE INDEX "Certificate_candidateId_idx" ON "Certificate"("candidateId");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "AdminNote_candidateId_idx" ON "AdminNote"("candidateId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_targetType_targetId_idx" ON "AuditLogEntry"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_actorStaffId_idx" ON "AuditLogEntry"("actorStaffId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_lineManagerId_fkey" FOREIGN KEY ("lineManagerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_examinationSittingId_fkey" FOREIGN KEY ("examinationSittingId") REFERENCES "ExaminationSitting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSitting" ADD CONSTRAINT "ExaminationSitting_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSitting" ADD CONSTRAINT "ExaminationSitting_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSitting" ADD CONSTRAINT "ExaminationSitting_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_revokedByStaffId_fkey" FOREIGN KEY ("revokedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_replacesCertificateId_fkey" FOREIGN KEY ("replacesCertificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_resolvedByStaffId_fkey" FOREIGN KEY ("resolvedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
