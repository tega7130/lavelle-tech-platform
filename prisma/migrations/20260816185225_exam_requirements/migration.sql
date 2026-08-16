-- CreateTable
CREATE TABLE "ExamRequirement" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamRequirement_examId_orderIndex_idx" ON "ExamRequirement"("examId", "orderIndex");

-- AddForeignKey
ALTER TABLE "ExamRequirement" ADD CONSTRAINT "ExamRequirement_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
