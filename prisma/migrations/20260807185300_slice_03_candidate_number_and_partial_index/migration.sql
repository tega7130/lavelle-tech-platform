-- A candidate cannot hold two live enrolments in the same programme, but
-- may re-enrol after withdrawing or being refunded — Prisma cannot express
-- a partial (WHERE-qualified) unique index, so it is written here as raw
-- SQL (README: "enrolment_one_live_per_programme").
CREATE UNIQUE INDEX enrolment_one_live_per_programme
  ON "Enrolment" ("candidateId", "programmeId")
  WHERE "status" NOT IN ('WITHDRAWN', 'REFUNDED');

-- Candidate number generator: LVL/2026/00291, one Postgres sequence per
-- calendar year — the same SECURITY DEFINER lazy-sequence pattern as
-- next_applicant_number(), including its concurrency fix from the start
-- (see that migration's comment). Assigned once, on first confirmed
-- payment, inside the enrolment transaction; never reassigned for a
-- second programme (candidate.candidateNumber IS NULL is the guard the
-- caller checks before calling this).
CREATE OR REPLACE FUNCTION next_candidate_number() RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  seq_name text := 'candidate_number_seq_' || yr;
  n bigint;
BEGIN
  BEGIN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  EXCEPTION WHEN duplicate_table OR unique_violation THEN
    NULL;
  END;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN 'LVL/' || yr || '/' || lpad(n::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_candidate_number() TO lavelle_app;
