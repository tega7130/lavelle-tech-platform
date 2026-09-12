-- CreateTable
CREATE TABLE "DocumentTemplateRelation" (
    "documentTemplateId" TEXT NOT NULL,
    "relatedDocumentTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateRelation_pkey" PRIMARY KEY ("documentTemplateId","relatedDocumentTemplateId")
);

-- CreateIndex
CREATE INDEX "DocumentTemplateRelation_relatedDocumentTemplateId_idx" ON "DocumentTemplateRelation"("relatedDocumentTemplateId");

-- AddForeignKey
ALTER TABLE "DocumentTemplateRelation" ADD CONSTRAINT "DocumentTemplateRelation_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateRelation" ADD CONSTRAINT "DocumentTemplateRelation_relatedDocumentTemplateId_fkey" FOREIGN KEY ("relatedDocumentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
