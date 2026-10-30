-- CreateEnum
CREATE TYPE "AzubiApplicationStatusKind" AS ENUM ('STUDENT', 'AWAITING_CALL', 'CALLED');

-- CreateEnum
CREATE TYPE "AzubiWorkingMode" AS ENUM ('ONSITE', 'HYBRID', 'ONLINE');

-- CreateEnum
CREATE TYPE "AzubiPipelineStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'SHORTLISTED', 'STATUS_CONFIRMED', 'MATCHED', 'PLACED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AzubiWritingAs" AS ENUM ('FELLOW', 'HOST', 'OTHER_ORG', 'OTHER');

-- CreateEnum
CREATE TYPE "AzubiEnquiryStatus" AS ENUM ('NEW', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AzubiEnquirySource" AS ENUM ('CONTACT_PAGE', 'HOME_FORM');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANAGE_AZUBI';

-- CreateTable
CREATE TABLE "AzubiApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "statusKind" "AzubiApplicationStatusKind" NOT NULL,
    "institution" TEXT NOT NULL,
    "workingMode" "AzubiWorkingMode" NOT NULL,
    "areas" TEXT[],
    "statement" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "pipelineStatus" "AzubiPipelineStatus" NOT NULL DEFAULT 'NEW',
    "assignedToStaffId" TEXT,
    "internalNotes" TEXT,
    "statusConfirmedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AzubiApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AzubiEnquiry" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organisation" TEXT,
    "writingAs" "AzubiWritingAs" NOT NULL,
    "message" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "status" "AzubiEnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedToStaffId" TEXT,
    "internalNotes" TEXT,
    "source" "AzubiEnquirySource" NOT NULL,
    "deleteAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AzubiEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AzubiApplication_pipelineStatus_createdAt_idx" ON "AzubiApplication"("pipelineStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AzubiApplication_createdAt_idx" ON "AzubiApplication"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AzubiEnquiry_status_createdAt_idx" ON "AzubiEnquiry"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AzubiEnquiry_writingAs_createdAt_idx" ON "AzubiEnquiry"("writingAs", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AzubiApplication" ADD CONSTRAINT "AzubiApplication_assignedToStaffId_fkey" FOREIGN KEY ("assignedToStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AzubiEnquiry" ADD CONSTRAINT "AzubiEnquiry_assignedToStaffId_fkey" FOREIGN KEY ("assignedToStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
