-- Partial unique index — Prisma can't express a WHERE clause on @@unique
-- (same discipline as Enrolment's enrolment_one_live_per_programme). A
-- cancelled registration doesn't block a fresh one for the same window.
CREATE UNIQUE INDEX exam_registration_one_live_per_window
  ON "ExamRegistration" ("candidateId", "windowId")
  WHERE "cancelledAt" IS NULL;
