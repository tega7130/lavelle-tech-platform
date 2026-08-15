-- DropForeignKey
ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAsset_uploadedByStaffId_fkey";

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "uploadedByCandidateId" UUID,
ALTER COLUMN "uploadedByStaffId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByStaffId_fkey" FOREIGN KEY ("uploadedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByCandidateId_fkey" FOREIGN KEY ("uploadedByCandidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint (hand-added — same rule as Session/Notification): a
-- MediaAsset was uploaded by staff or by a candidate, never both, never
-- neither.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "media_asset_exactly_one_owner" CHECK (num_nonnulls("uploadedByStaffId", "uploadedByCandidateId") = 1);
