/*
  Warnings:

  - Added the required column `country` to the `AzubiApplication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `AzubiEnquiry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add nullable first (existing rows pre-date these fields),
-- backfill a placeholder, then enforce NOT NULL — avoids failing on any
-- rows submitted before this migration.
ALTER TABLE "AzubiApplication" ADD COLUMN     "country" TEXT,
ADD COLUMN     "otherAreaDetail" TEXT;
UPDATE "AzubiApplication" SET "country" = 'Nigeria' WHERE "country" IS NULL;
ALTER TABLE "AzubiApplication" ALTER COLUMN "country" SET NOT NULL;

-- AlterTable
ALTER TABLE "AzubiEnquiry" ADD COLUMN     "phone" TEXT;
UPDATE "AzubiEnquiry" SET "phone" = 'not provided' WHERE "phone" IS NULL;
ALTER TABLE "AzubiEnquiry" ALTER COLUMN "phone" SET NOT NULL;
