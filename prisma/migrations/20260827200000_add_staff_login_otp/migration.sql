-- CreateTable
CREATE TABLE "StaffLoginOtpChallenge" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLoginOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLoginOtpChallenge_staffId_verifiedAt_idx" ON "StaffLoginOtpChallenge"("staffId", "verifiedAt");

-- AddForeignKey
ALTER TABLE "StaffLoginOtpChallenge" ADD CONSTRAINT "StaffLoginOtpChallenge_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
