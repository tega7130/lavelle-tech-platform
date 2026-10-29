-- CreateEnum
CREATE TYPE "LawyerEntityType" AS ENUM ('INDIVIDUAL', 'LAW_FIRM');

-- CreateEnum
CREATE TYPE "LawyerWebsiteVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LawyerWebsiteSectionKey" AS ENUM ('ABOUT', 'PRACTICE_AREAS', 'QUALIFICATIONS', 'EXPERIENCE', 'PUBLICATIONS', 'ACTIVITIES', 'SOCIAL_CONTACT', 'CV');

-- CreateEnum
CREATE TYPE "LawyerQualificationSource" AS ENUM ('MANUAL', 'LAVELLE_CERTIFICATE');

-- CreateEnum
CREATE TYPE "LawyerPublicationKind" AS ENUM ('EXTERNAL_LINK', 'NATIVE_ARTICLE');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANAGE_LAWYER_WEBSITES';

-- CreateTable
CREATE TABLE "LawyerWebsite" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "entityType" "LawyerEntityType" NOT NULL,
    "firmName" TEXT,
    "handle" TEXT NOT NULL,
    "templateKey" TEXT,
    "colorThemeKey" TEXT,
    "fontPairingKey" TEXT,
    "introText" TEXT,
    "biographyText" TEXT,
    "personalStatementText" TEXT,
    "careerJourneyText" TEXT,
    "personalInterestsText" TEXT,
    "practiceAreas" JSONB NOT NULL,
    "socialLinks" JSONB NOT NULL,
    "cvAssetId" TEXT,
    "conductDisclaimerAcknowledgedAt" TIMESTAMP(3),
    "conductDisclaimerVersion" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "publishRequestedAt" TIMESTAMP(3),
    "takenDownAt" TIMESTAMP(3),
    "takenDownReason" TEXT,
    "takenDownByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerWebsiteVerification" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "scnNumber" TEXT,
    "idCardEvidenceAssetId" TEXT,
    "cacNumber" TEXT,
    "firmEvidenceAssetId" TEXT,
    "status" "LawyerWebsiteVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerWebsiteVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerWebsiteSection" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "sectionKey" "LawyerWebsiteSectionKey" NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerWebsiteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerQualification" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "source" "LawyerQualificationSource" NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "year" INTEGER,
    "certificateId" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerExperience" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerPublication" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "kind" "LawyerPublicationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "externalUrl" TEXT,
    "slug" TEXT,
    "excerpt" TEXT,
    "body" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerActivity" (
    "id" TEXT NOT NULL,
    "lawyerWebsiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "year" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawyerWebsite_candidateId_key" ON "LawyerWebsite"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerWebsite_handle_key" ON "LawyerWebsite"("handle");

-- CreateIndex
CREATE INDEX "LawyerWebsite_isPublished_idx" ON "LawyerWebsite"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerWebsiteVerification_lawyerWebsiteId_key" ON "LawyerWebsiteVerification"("lawyerWebsiteId");

-- CreateIndex
CREATE INDEX "LawyerWebsiteVerification_status_idx" ON "LawyerWebsiteVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerWebsiteSection_lawyerWebsiteId_sectionKey_key" ON "LawyerWebsiteSection"("lawyerWebsiteId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "LawyerPublication_slug_key" ON "LawyerPublication"("slug");

-- CreateIndex
CREATE INDEX "LawyerPublication_slug_idx" ON "LawyerPublication"("slug");

-- AddForeignKey
ALTER TABLE "LawyerWebsite" ADD CONSTRAINT "LawyerWebsite_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsite" ADD CONSTRAINT "LawyerWebsite_cvAssetId_fkey" FOREIGN KEY ("cvAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsite" ADD CONSTRAINT "LawyerWebsite_takenDownByStaffId_fkey" FOREIGN KEY ("takenDownByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsiteVerification" ADD CONSTRAINT "LawyerWebsiteVerification_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsiteVerification" ADD CONSTRAINT "LawyerWebsiteVerification_idCardEvidenceAssetId_fkey" FOREIGN KEY ("idCardEvidenceAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsiteVerification" ADD CONSTRAINT "LawyerWebsiteVerification_firmEvidenceAssetId_fkey" FOREIGN KEY ("firmEvidenceAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsiteVerification" ADD CONSTRAINT "LawyerWebsiteVerification_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerWebsiteSection" ADD CONSTRAINT "LawyerWebsiteSection_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerQualification" ADD CONSTRAINT "LawyerQualification_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerQualification" ADD CONSTRAINT "LawyerQualification_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerExperience" ADD CONSTRAINT "LawyerExperience_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerPublication" ADD CONSTRAINT "LawyerPublication_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerActivity" ADD CONSTRAINT "LawyerActivity_lawyerWebsiteId_fkey" FOREIGN KEY ("lawyerWebsiteId") REFERENCES "LawyerWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
