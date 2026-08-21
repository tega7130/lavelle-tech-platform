-- AlterTable
ALTER TABLE "ProgrammeListing" ADD COLUMN     "useCoverVideo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "videoAssetId" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- AddForeignKey
ALTER TABLE "ProgrammeListing" ADD CONSTRAINT "ProgrammeListing_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
