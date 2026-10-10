-- CreateTable
CREATE TABLE "PracticeArea" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeArea_code_key" ON "PracticeArea"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeArea_name_key" ON "PracticeArea"("name");

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN "practiceAreaId" TEXT;

-- CreateIndex
CREATE INDEX "Programme_practiceAreaId_tier_idx" ON "Programme"("practiceAreaId", "tier");

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_practiceAreaId_fkey" FOREIGN KEY ("practiceAreaId") REFERENCES "PracticeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the practice areas named in the original request as "current
-- examples" — lets the admin create a programme immediately without
-- first having to author practice areas from nothing. Idempotent: safe
-- to run even if one or more of these codes already exists.
INSERT INTO "PracticeArea" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'PDP', 'Privacy & Data Protection', now(), now()),
  (gen_random_uuid()::text, 'REG', 'Regulatory', now(), now()),
  (gen_random_uuid()::text, 'CON', 'Contracts', now(), now())
ON CONFLICT ("code") DO NOTHING;
