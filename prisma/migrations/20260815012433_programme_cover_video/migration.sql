-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "coverVideoAssetId" TEXT,
ADD COLUMN     "coverVideoUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_coverVideoAssetId_fkey" FOREIGN KEY ("coverVideoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
