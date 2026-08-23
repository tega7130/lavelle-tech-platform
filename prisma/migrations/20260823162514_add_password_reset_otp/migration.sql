-- CreateTable
CREATE TABLE "PasswordResetOtpChallenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidateId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetOtpChallenge_candidateId_verifiedAt_idx" ON "PasswordResetOtpChallenge"("candidateId", "verifiedAt");

-- AddForeignKey
ALTER TABLE "PasswordResetOtpChallenge" ADD CONSTRAINT "PasswordResetOtpChallenge_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
