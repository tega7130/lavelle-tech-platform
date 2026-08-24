/*
  Warnings:

  - You are about to drop the column `completedAt` on the `VideoWatchProgress` table. All the data in the column will be lost.
  - You are about to drop the column `durationSeconds` on the `VideoWatchProgress` table. All the data in the column will be lost.
  - You are about to drop the column `watchedPercent` on the `VideoWatchProgress` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lecture" ADD COLUMN     "durationSeconds" INTEGER;

-- AlterTable
ALTER TABLE "VideoWatchProgress" DROP COLUMN "completedAt",
DROP COLUMN "durationSeconds",
DROP COLUMN "watchedPercent";
