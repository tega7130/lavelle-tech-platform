-- CreateEnum
CREATE TYPE "MarkState" AS ENUM ('AWAITING', 'IN_REVIEW', 'RETURNED', 'RESUBMISSION_REQUESTED');

-- CreateEnum
CREATE TYPE "GradeBand" AS ENUM ('DISTINCTION', 'MERIT', 'PASS', 'REFER');

-- CreateEnum
CREATE TYPE "MarkableKind" AS ENUM ('DRAFTING', 'EXAMINATION_WRITTEN');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MODERATE_MARKS';

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "blindMarking" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GradeBandDefinition" (
    "id" TEXT NOT NULL,
    "band" "GradeBand" NOT NULL,
    "minPercent" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "GradeBandDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "MarkableKind" NOT NULL,
    "draftingSubmissionId" TEXT,
    "examWrittenAnswerId" TEXT,
    "state" "MarkState" NOT NULL DEFAULT 'AWAITING',
    "scorePercent" INTEGER,
    "band" "GradeBand",
    "feedback" TEXT,
    "rubricScores" JSONB,
    "markedByStaffId" TEXT,
    "markedAt" TIMESTAMP(3),
    "moderatedByStaffId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkRubric" (
    "id" TEXT NOT NULL,
    "lectureId" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "MarkRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkRubricCriterion" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "maxMarks" INTEGER NOT NULL,

    CONSTRAINT "MarkRubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeResult" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "quizAveragePercent" INTEGER,
    "draftingAveragePercent" INTEGER,
    "examinationPercent" INTEGER,
    "finalPercent" INTEGER,
    "band" "GradeBand",
    "weightingSnapshot" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3),
    "isProvisional" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgrammeResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeBandDefinition_effectiveFrom_effectiveTo_idx" ON "GradeBandDefinition"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_draftingSubmissionId_key" ON "Mark"("draftingSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_examWrittenAnswerId_key" ON "Mark"("examWrittenAnswerId");

-- CreateIndex
CREATE INDEX "Mark_state_createdAt_idx" ON "Mark"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Mark_enrolmentId_idx" ON "Mark"("enrolmentId");

-- CreateIndex
CREATE INDEX "Mark_markedByStaffId_markedAt_idx" ON "Mark"("markedByStaffId", "markedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeResult_enrolmentId_key" ON "ProgrammeResult"("enrolmentId");

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_draftingSubmissionId_fkey" FOREIGN KEY ("draftingSubmissionId") REFERENCES "DraftingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_markedByStaffId_fkey" FOREIGN KEY ("markedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_moderatedByStaffId_fkey" FOREIGN KEY ("moderatedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkRubric" ADD CONSTRAINT "MarkRubric_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkRubricCriterion" ADD CONSTRAINT "MarkRubricCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "MarkRubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeResult" ADD CONSTRAINT "ProgrammeResult_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
