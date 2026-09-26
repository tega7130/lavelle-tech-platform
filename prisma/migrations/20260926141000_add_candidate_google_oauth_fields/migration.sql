-- AlterTable
-- These columns (and the CandidateOAuthProvider table, added in an
-- earlier untracked migration) were hand-applied to staging/production
-- when Google OAuth shipped, but a migration file was never generated for
-- them at the time — this backfills the migration history to match what
-- staging/production already have.
ALTER TABLE "Candidate" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "Candidate" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "googleId" VARCHAR(255),
ADD COLUMN     "googleEmail" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_googleId_key" ON "Candidate"("googleId");
