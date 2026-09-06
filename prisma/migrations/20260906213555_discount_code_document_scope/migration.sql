-- CreateTable
CREATE TABLE "DiscountCodeDocument" (
    "discountCodeId" TEXT NOT NULL,
    "documentTemplateId" TEXT NOT NULL,

    CONSTRAINT "DiscountCodeDocument_pkey" PRIMARY KEY ("discountCodeId","documentTemplateId")
);

-- CreateIndex
CREATE INDEX "DiscountCodeDocument_documentTemplateId_idx" ON "DiscountCodeDocument"("documentTemplateId");

-- AddForeignKey
ALTER TABLE "DiscountCodeDocument" ADD CONSTRAINT "DiscountCodeDocument_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeDocument" ADD CONSTRAINT "DiscountCodeDocument_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
