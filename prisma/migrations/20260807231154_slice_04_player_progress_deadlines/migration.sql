-- CreateEnum
CREATE TYPE "LectureState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'RESUBMITTED');

-- CreateEnum
CREATE TYPE "DeadlineKind" AS ENUM ('LECTURE_RELEASE', 'DRAFTING_DUE', 'QUIZ_DUE', 'EXAMINATION');

-- CreateTable
CREATE TABLE "LectureProgress" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "state" "LectureState" NOT NULL DEFAULT 'NOT_STARTED',
    "slideIndex" INTEGER NOT NULL DEFAULT 0,
    "mediaPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "stepsCompleted" TEXT[],
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftingSubmission" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "state" "SubmissionState" NOT NULL DEFAULT 'DRAFT',
    "body" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentAssetId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "scorePercent" INTEGER,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "kind" "DeadlineKind" NOT NULL,
    "lectureId" TEXT,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "originalDueAt" TIMESTAMP(3) NOT NULL,
    "extendedReason" TEXT,
    "metAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LectureProgress_enrolmentId_lastSeenAt_idx" ON "LectureProgress"("enrolmentId", "lastSeenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LectureProgress_enrolmentId_lectureId_key" ON "LectureProgress"("enrolmentId", "lectureId");

-- CreateIndex
CREATE INDEX "DraftingSubmission_enrolmentId_lectureId_attemptNumber_idx" ON "DraftingSubmission"("enrolmentId", "lectureId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuizAttempt_enrolmentId_quizId_idx" ON "QuizAttempt"("enrolmentId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Deadline_enrolmentId_dueAt_idx" ON "Deadline"("enrolmentId", "dueAt");

-- CreateIndex
CREATE INDEX "Deadline_dueAt_idx" ON "Deadline"("dueAt");

-- AddForeignKey
ALTER TABLE "LectureProgress" ADD CONSTRAINT "LectureProgress_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureProgress" ADD CONSTRAINT "LectureProgress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftingSubmission" ADD CONSTRAINT "DraftingSubmission_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftingSubmission" ADD CONSTRAINT "DraftingSubmission_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftingSubmission" ADD CONSTRAINT "DraftingSubmission_attachmentAssetId_fkey" FOREIGN KEY ("attachmentAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "QuizOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
