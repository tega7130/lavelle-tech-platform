-- CreateTable
CREATE TABLE "VideoWatchProgress" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "maxPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "watchedPercent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoWatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoWatchProgress_lectureId_idx" ON "VideoWatchProgress"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoWatchProgress_enrolmentId_lectureId_key" ON "VideoWatchProgress"("enrolmentId", "lectureId");

-- AddForeignKey
ALTER TABLE "VideoWatchProgress" ADD CONSTRAINT "VideoWatchProgress_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoWatchProgress" ADD CONSTRAINT "VideoWatchProgress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
