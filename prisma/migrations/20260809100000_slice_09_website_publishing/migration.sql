-- AlterEnum
ALTER TYPE "RequestCategory" ADD VALUE 'ENQUIRY';

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProgrammeListing" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "useDefaults" BOOLEAN NOT NULL DEFAULT true,
    "headline" TEXT,
    "summary" TEXT,
    "outcomes" JSONB,
    "includes" JSONB,
    "assessmentNote" TEXT,
    "paymentNote" TEXT,
    "heroAssetId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedByStaffId" TEXT,
    "unpublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorTitle" TEXT NOT NULL,
    "programmeId" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEnquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "programmeOfInterestId" TEXT,
    "message" TEXT NOT NULL,
    "supportRequestId" TEXT,
    "handledByStaffId" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeListing_programmeId_key" ON "ProgrammeListing"("programmeId");

-- CreateIndex
CREATE INDEX "ProgrammeListing_isPublished_orderIndex_idx" ON "ProgrammeListing"("isPublished", "orderIndex");

-- CreateIndex
CREATE INDEX "Review_isPublished_orderIndex_idx" ON "Review"("isPublished", "orderIndex");

-- CreateIndex
CREATE INDEX "FaqEntry_isPublished_orderIndex_idx" ON "FaqEntry"("isPublished", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ContactEnquiry_supportRequestId_key" ON "ContactEnquiry"("supportRequestId");

-- CreateIndex
CREATE INDEX "ContactEnquiry_createdAt_idx" ON "ContactEnquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "ProgrammeListing" ADD CONSTRAINT "ProgrammeListing_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeListing" ADD CONSTRAINT "ProgrammeListing_heroAssetId_fkey" FOREIGN KEY ("heroAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeListing" ADD CONSTRAINT "ProgrammeListing_publishedByStaffId_fkey" FOREIGN KEY ("publishedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEnquiry" ADD CONSTRAINT "ContactEnquiry_programmeOfInterestId_fkey" FOREIGN KEY ("programmeOfInterestId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEnquiry" ADD CONSTRAINT "ContactEnquiry_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "SupportRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEnquiry" ADD CONSTRAINT "ContactEnquiry_handledByStaffId_fkey" FOREIGN KEY ("handledByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

