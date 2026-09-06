-- Admin-manageable document categories (mirrors ProgrammeCategory).
-- Hand-edited from Prisma's naive diff: that version dropped
-- DocumentTemplate.category and added categoryId NOT NULL with no
-- backfill, which loses every existing row's category. This version
-- creates DocumentCategory, seeds the five starting categories with
-- slugs matching the exact string values the app has only ever written
-- (CONTRACTS/MOUS/AGREEMENTS/EMPLOYMENT/OTHER), backfills categoryId
-- from the old category column by matching that slug, then drops the
-- old column only once every row has a categoryId.

-- CreateTable
CREATE TABLE "DocumentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_name_key" ON "DocumentCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_slug_key" ON "DocumentCategory"("slug");

-- Seed the five starting categories (Phase 1's original fixed list).
INSERT INTO "DocumentCategory" ("id", "name", "slug") VALUES
  (gen_random_uuid()::text, 'Contracts', 'CONTRACTS'),
  (gen_random_uuid()::text, 'MOUs', 'MOUS'),
  (gen_random_uuid()::text, 'Agreements', 'AGREEMENTS'),
  (gen_random_uuid()::text, 'Employment', 'EMPLOYMENT'),
  (gen_random_uuid()::text, 'Other', 'OTHER');

-- AlterTable — nullable for now, backfilled below, then locked down.
ALTER TABLE "DocumentTemplate" ADD COLUMN "categoryId" TEXT;

-- Backfill every existing row by matching its old category string to the
-- seeded slug. Any row whose category value doesn't match one of the
-- five (should never happen — the app has never written anything else)
-- falls back to "OTHER" rather than leaving categoryId null.
UPDATE "DocumentTemplate" dt
SET "categoryId" = dc.id
FROM "DocumentCategory" dc
WHERE dc.slug = dt.category;

UPDATE "DocumentTemplate" dt
SET "categoryId" = (SELECT id FROM "DocumentCategory" WHERE slug = 'OTHER')
WHERE dt."categoryId" IS NULL;

-- DropIndex
DROP INDEX "DocumentTemplate_category_idx";

-- AlterTable — drop the old column now that every row has a categoryId, and lock the new column down.
ALTER TABLE "DocumentTemplate" DROP COLUMN "category";
ALTER TABLE "DocumentTemplate" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentTemplate_categoryId_idx" ON "DocumentTemplate"("categoryId");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
