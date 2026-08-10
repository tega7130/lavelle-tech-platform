/*
  Warnings:

  - You are about to drop the column `isPublished` on the `Review` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConductReview" AS ENUM ('PENDING', 'CLEARED', 'REFERRED');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('PENDING', 'PUBLISHED', 'DECLINED');

-- DropIndex
DROP INDEX "Review_isPublished_orderIndex_idx";

-- AlterTable
-- state is added ALONGSIDE isPublished first (not replacing it in the same
-- statement) so the data migration below can read the old boolean before
-- it's gone: true -> PUBLISHED, false -> PENDING (README D1 — no existing
-- row can migrate to DECLINED, since that state didn't exist before).
ALTER TABLE "Review" ADD COLUMN     "candidateId" UUID,
ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "enrolmentId" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedByStaffId" TEXT,
ADD COLUMN     "state" "ReviewState" NOT NULL DEFAULT 'PENDING';

-- DataMigration
UPDATE "Review" SET "state" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"ReviewState" ELSE 'PENDING'::"ReviewState" END;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "isPublished";

-- AlterTable
ALTER TABLE "Sitting" ADD COLUMN     "conductReview" "ConductReview" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "invigilatorFinding" TEXT,
ADD COLUMN     "referredAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByStaffId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedByStaffId" TEXT,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateIndex
CREATE INDEX "Review_state_orderIndex_idx" ON "Review"("state", "orderIndex");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_suspendedByStaffId_fkey" FOREIGN KEY ("suspendedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedByStaffId_fkey" FOREIGN KEY ("moderatedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
