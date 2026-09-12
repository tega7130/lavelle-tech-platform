-- CreateTable VideoUpload
CREATE TABLE "VideoUpload" (
  "id" TEXT NOT NULL,
  "candidateId" UUID NOT NULL,
  "cloudinaryId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoUpload_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VideoUpload" ADD CONSTRAINT "VideoUpload_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "VideoUpload_cloudinaryId_key" ON "VideoUpload"("cloudinaryId");

-- CreateIndex
CREATE INDEX "VideoUpload_candidateId_createdAt_idx" ON "VideoUpload"("candidateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "VideoUpload_status_createdAt_idx" ON "VideoUpload"("status", "createdAt" DESC);
