-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DocumentTemplate_deletedAt_idx" ON "DocumentTemplate"("deletedAt");
