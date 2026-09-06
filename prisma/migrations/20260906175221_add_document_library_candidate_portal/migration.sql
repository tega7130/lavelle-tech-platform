-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'DOCUMENT_PURCHASE';

-- CreateTable
CREATE TABLE "DocumentFavorite" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" CITEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPurchase" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "originalPriceMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "discountCodeId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFavorite_documentTemplateId_idx" ON "DocumentFavorite"("documentTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFavorite_candidateId_documentTemplateId_key" ON "DocumentFavorite"("candidateId", "documentTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurchase_paymentId_key" ON "DocumentPurchase"("paymentId");

-- CreateIndex
CREATE INDEX "DocumentPurchase_documentTemplateId_idx" ON "DocumentPurchase"("documentTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurchase_candidateId_documentTemplateId_key" ON "DocumentPurchase"("candidateId", "documentTemplateId");

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFavorite" ADD CONSTRAINT "DocumentFavorite_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPurchase" ADD CONSTRAINT "DocumentPurchase_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPurchase" ADD CONSTRAINT "DocumentPurchase_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPurchase" ADD CONSTRAINT "DocumentPurchase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPurchase" ADD CONSTRAINT "DocumentPurchase_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
