-- The three rows here are scaffold-era placeholders seeded under the OLD
-- shape (identifier/grade, no certificateNumber/band/pathway/template) —
-- the whole table is being replaced wholesale by the real Slice 07 schema,
-- same as Slice 06 dropped the placeholder Question/Examination tables
-- rather than migrating their data forward. prisma/seed.ts re-creates the
-- same three scenarios (active, revoked-with-successor, superseded) under
-- the new shape immediately after this migration is applied.
DELETE FROM "Certificate";

-- CreateEnum
CREATE TYPE "CredentialPathway" AS ENUM ('PATHWAY', 'EXAMINATION_ONLY');

-- AlterEnum
ALTER TYPE "CertificateStatus" ADD VALUE 'SUPERSEDED';

-- DropForeignKey
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_replacesCertificateId_fkey";

-- DropIndex
DROP INDEX "Certificate_candidateId_idx";

-- DropIndex
DROP INDEX "Certificate_identifier_key";

-- DropIndex
DROP INDEX "Certificate_replacesCertificateId_key";

-- DropIndex
DROP INDEX "Certificate_status_idx";

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "grade",
DROP COLUMN "identifier",
DROP COLUMN "replacesCertificateId",
ADD COLUMN     "band" "GradeBand" NOT NULL,
ADD COLUMN     "candidateNumber" TEXT,
ADD COLUMN     "certificateNumber" TEXT NOT NULL,
ADD COLUMN     "enrolmentId" TEXT,
ADD COLUMN     "finalPercent" INTEGER NOT NULL,
ADD COLUMN     "holderName" TEXT NOT NULL,
ADD COLUMN     "issuedByStaffId" TEXT,
ADD COLUMN     "pathway" "CredentialPathway" NOT NULL,
ADD COLUMN     "pdfAssetId" TEXT,
ADD COLUMN     "programmeTitle" TEXT NOT NULL,
ADD COLUMN     "replacesId" TEXT,
ADD COLUMN     "sittingId" TEXT,
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "templateId" TEXT NOT NULL,
ADD COLUMN     "verificationCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "issuedAt" DROP DEFAULT;

-- DropEnum
DROP TYPE "Grade";

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artworkAssetId" TEXT NOT NULL,
    "appliesToTier" "ProgrammeTier",
    "signatoryBlock" TEXT NOT NULL,
    "printedFields" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLookup" (
    "id" TEXT NOT NULL,
    "queriedNumber" TEXT NOT NULL,
    "certificateId" TEXT,
    "result" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationLookup_certificateId_createdAt_idx" ON "VerificationLookup"("certificateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VerificationLookup_createdAt_idx" ON "VerificationLookup"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_sittingId_key" ON "Certificate"("sittingId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_supersededById_key" ON "Certificate"("supersededById");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_replacesId_key" ON "Certificate"("replacesId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_pdfAssetId_key" ON "Certificate"("pdfAssetId");

-- CreateIndex
CREATE INDEX "Certificate_candidateId_status_idx" ON "Certificate"("candidateId", "status");

-- CreateIndex
CREATE INDEX "Certificate_programmeId_issuedAt_idx" ON "Certificate"("programmeId", "issuedAt");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "Sitting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuedByStaffId_fkey" FOREIGN KEY ("issuedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_pdfAssetId_fkey" FOREIGN KEY ("pdfAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_artworkAssetId_fkey" FOREIGN KEY ("artworkAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateTemplate" ADD CONSTRAINT "CertificateTemplate_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLookup" ADD CONSTRAINT "VerificationLookup_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

