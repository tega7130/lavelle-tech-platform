-- Beta Access (temporary) — see the schema.prisma comment block above
-- BetaFeature for removal instructions when the beta ends.

-- CreateEnum
CREATE TYPE "BetaFeature" AS ENUM ('PROGRAMME', 'DOCUMENT_LIBRARY');

-- CreateEnum
CREATE TYPE "BetaSignupStatus" AS ENUM ('GRANTED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "BetaGrantSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "BetaFeedbackKind" AS ENUM ('COMPLETION', 'WAITLIST_INTEREST');

-- CreateTable
CREATE TABLE "BetaFeatureSignup" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "feature" "BetaFeature" NOT NULL,
    "status" "BetaSignupStatus" NOT NULL,
    "source" "BetaGrantSource",
    "notifiedPublicAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaFeatureSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "feature" "BetaFeature" NOT NULL,
    "kind" "BetaFeedbackKind" NOT NULL,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "signupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetaFeatureSignup_feature_status_idx" ON "BetaFeatureSignup"("feature", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BetaFeatureSignup_candidateId_feature_key" ON "BetaFeatureSignup"("candidateId", "feature");

-- CreateIndex
CREATE INDEX "BetaFeedback_feature_kind_createdAt_idx" ON "BetaFeedback"("feature", "kind", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "BetaFeatureSignup" ADD CONSTRAINT "BetaFeatureSignup_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaFeedback" ADD CONSTRAINT "BetaFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaFeedback" ADD CONSTRAINT "BetaFeedback_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "BetaFeatureSignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
