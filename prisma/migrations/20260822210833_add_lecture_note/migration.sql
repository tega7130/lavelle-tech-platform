-- CreateTable
CREATE TABLE "LectureNote" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LectureNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LectureNote_enrolmentId_updatedAt_idx" ON "LectureNote"("enrolmentId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LectureNote_enrolmentId_lectureId_key" ON "LectureNote"("enrolmentId", "lectureId");

-- AddForeignKey
ALTER TABLE "LectureNote" ADD CONSTRAINT "LectureNote_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureNote" ADD CONSTRAINT "LectureNote_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
