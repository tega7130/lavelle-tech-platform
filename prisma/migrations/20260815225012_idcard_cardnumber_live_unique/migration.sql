-- DropIndex
DROP INDEX "IdCard_cardNumber_key";

-- CreateIndex
CREATE INDEX "IdCard_cardNumber_idx" ON "IdCard"("cardNumber");

-- Partial unique index — Prisma can't express a WHERE clause on @@unique
-- (same discipline as ExamRegistration's one-live-per-window index). A
-- retired card no longer blocks its own number: reissueIdCard creates a
-- successor row that keeps the SAME cardNumber as the one it retires
-- (matching a physical card reprinted with its existing number), so the
-- real constraint is "at most one LIVE card per number", never global.
CREATE UNIQUE INDEX id_card_cardnumber_one_live
  ON "IdCard" ("cardNumber")
  WHERE "retiredAt" IS NULL;
