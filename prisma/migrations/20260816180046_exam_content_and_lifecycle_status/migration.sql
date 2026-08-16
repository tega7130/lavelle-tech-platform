-- AlterEnum
ALTER TYPE "ExamStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByStaffId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedByStaffId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "examFormat" TEXT,
ADD COLUMN     "examinationAreas" JSONB,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "onPassing" JSONB;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_closedByStaffId_fkey" FOREIGN KEY ("closedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_archivedByStaffId_fkey" FOREIGN KEY ("archivedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
