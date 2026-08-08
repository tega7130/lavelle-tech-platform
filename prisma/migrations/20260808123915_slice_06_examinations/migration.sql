-- CreateEnum
CREATE TYPE "ExamQuestionType" AS ENUM ('OBJECTIVE', 'WRITTEN');

-- CreateEnum
CREATE TYPE "ExamQuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SittingState" AS ENUM ('REGISTERED', 'IN_PROGRESS', 'SUBMITTED', 'FORFEITED', 'EXPIRED', 'MARKED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ExamOutcome" AS ENUM ('PASS', 'REFER');

-- CreateEnum
CREATE TYPE "AttemptPolicy" AS ENUM ('ONE_ATTEMPT', 'TWO_ATTEMPTS', 'ONE_RESIT_ON_REFERRAL');

-- DropForeignKey
ALTER TABLE "Examination" DROP CONSTRAINT "Examination_programmeId_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationSitting" DROP CONSTRAINT "ExaminationSitting_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationSitting" DROP CONSTRAINT "ExaminationSitting_examinationId_fkey";

-- DropForeignKey
ALTER TABLE "ExaminationSitting" DROP CONSTRAINT "ExaminationSitting_intakeId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_examinationSittingId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_moduleId_fkey";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "examinationSittingId";

-- DropTable
DROP TABLE "Examination";

-- DropTable
DROP TABLE "ExaminationSitting";

-- DropTable
DROP TABLE "Question";

-- DropEnum
DROP TYPE "QuestionDifficulty";

-- DropEnum
DROP TYPE "QuestionStatus";

-- DropEnum
DROP TYPE "QuestionType";

-- DropEnum
DROP TYPE "SittingStatus";

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "durationMinutes" INTEGER NOT NULL,
    "passMarkPercent" INTEGER NOT NULL DEFAULT 60,
    "attemptPolicy" "AttemptPolicy" NOT NULL DEFAULT 'ONE_RESIT_ON_REFERRAL',
    "feeMinor" INTEGER NOT NULL,
    "enforceFullScreen" BOOLEAN NOT NULL DEFAULT true,
    "warnOnTabSwitch" BOOLEAN NOT NULL DEFAULT true,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "allowReviewBeforeSubmit" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "publishedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" "ExamQuestionType" NOT NULL,
    "status" "ExamQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "prompt" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "examinerNote" TEXT,
    "guidance" TEXT,
    "wordLimit" INTEGER,
    "retiredAt" TIMESTAMP(3),
    "retiredReason" TEXT,
    "retiredByStaffId" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExamQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamWindow" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRegistration" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "examId" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "enrolmentId" TEXT,
    "paymentId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sitting" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "state" "SittingState" NOT NULL DEFAULT 'REGISTERED',
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "forfeitedAt" TIMESTAMP(3),
    "paperSnapshot" JSONB,
    "objectivePercent" INTEGER,
    "writtenPercent" INTEGER,
    "totalPercent" INTEGER,
    "outcome" "ExamOutcome",
    "band" "GradeBand",
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SittingAnswer" (
    "id" TEXT NOT NULL,
    "sittingId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "writtenAnswer" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SittingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringEvent" (
    "id" TEXT NOT NULL,
    "sittingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB,

    CONSTRAINT "ProctoringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_programmeId_key" ON "Exam"("programmeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_supersededById_key" ON "ExamQuestion"("supersededById");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_moduleId_status_idx" ON "ExamQuestion"("examId", "moduleId", "status");

-- CreateIndex
CREATE INDEX "ExamWindow_examId_opensAt_idx" ON "ExamWindow"("examId", "opensAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRegistration_paymentId_key" ON "ExamRegistration"("paymentId");

-- CreateIndex
CREATE INDEX "ExamRegistration_candidateId_examId_idx" ON "ExamRegistration"("candidateId", "examId");

-- CreateIndex
CREATE INDEX "ExamRegistration_windowId_idx" ON "ExamRegistration"("windowId");

-- CreateIndex
CREATE UNIQUE INDEX "Sitting_registrationId_key" ON "Sitting"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "SittingAnswer_sittingId_questionId_key" ON "SittingAnswer"("sittingId", "questionId");

-- CreateIndex
CREATE INDEX "ProctoringEvent_sittingId_occurredAt_idx" ON "ProctoringEvent"("sittingId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_examWrittenAnswerId_fkey" FOREIGN KEY ("examWrittenAnswerId") REFERENCES "SittingAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_publishedByStaffId_fkey" FOREIGN KEY ("publishedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_retiredByStaffId_fkey" FOREIGN KEY ("retiredByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ExamQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestionOption" ADD CONSTRAINT "ExamQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamWindow" ADD CONSTRAINT "ExamWindow_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "ExamWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ExamRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SittingAnswer" ADD CONSTRAINT "SittingAnswer_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "Sitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SittingAnswer" ADD CONSTRAINT "SittingAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SittingAnswer" ADD CONSTRAINT "SittingAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "ExamQuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringEvent" ADD CONSTRAINT "ProctoringEvent_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "Sitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

