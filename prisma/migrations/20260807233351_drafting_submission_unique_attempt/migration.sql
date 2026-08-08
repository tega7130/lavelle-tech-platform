-- DraftingSubmission has no rows yet (brand new table from the previous
-- migration), so this is safe to apply directly.
DROP INDEX "DraftingSubmission_enrolmentId_lectureId_attemptNumber_idx";

CREATE UNIQUE INDEX "DraftingSubmission_enrolmentId_lectureId_attemptNumber_key" ON "DraftingSubmission"("enrolmentId", "lectureId", "attemptNumber");
