-- Backfill only. "CandidateOAuthProvider" was created out-of-band when
-- Google OAuth shipped (same drift class as
-- 20260926141000_add_candidate_google_oauth_fields) and already exists on
-- every environment, but its two non-unique indexes were never actually
-- created anywhere and no migration file ever captured any of it. Every
-- statement is idempotent so this is safe to run as-is on an environment
-- that already has the table (it just adds the missing indexes) or one
-- that doesn't (it creates the table fresh).

-- CreateTable
CREATE TABLE IF NOT EXISTS "CandidateOAuthProvider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidateId" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "providerUserId" VARCHAR(255) NOT NULL,
    "providerEmail" VARCHAR(255),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateOAuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CandidateOAuthProvider_candidateId_provider_key" ON "CandidateOAuthProvider"("candidateId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CandidateOAuthProvider_candidateId_idx" ON "CandidateOAuthProvider"("candidateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CandidateOAuthProvider_provider_providerUserId_idx" ON "CandidateOAuthProvider"("provider", "providerUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CandidateOAuthProvider" ADD CONSTRAINT "CandidateOAuthProvider_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
