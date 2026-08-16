-- CreateTable
CREATE TABLE "ExamStaffAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignedByStaffId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamStaffAssignment_staffId_idx" ON "ExamStaffAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStaffAssignment_examId_staffId_key" ON "ExamStaffAssignment"("examId", "staffId");

-- AddForeignKey
ALTER TABLE "ExamStaffAssignment" ADD CONSTRAINT "ExamStaffAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStaffAssignment" ADD CONSTRAINT "ExamStaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStaffAssignment" ADD CONSTRAINT "ExamStaffAssignment_assignedByStaffId_fkey" FOREIGN KEY ("assignedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
