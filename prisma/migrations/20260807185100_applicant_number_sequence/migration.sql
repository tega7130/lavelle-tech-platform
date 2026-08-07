-- Applicant number generator: LVL-APP-{year}-{sequence}, sequence
-- zero-padded to 5 digits, one Postgres sequence per calendar year.
-- Deliberately NOT derived from COUNT(*), which races and reuses numbers
-- after deletion — nextval() on a real sequence guarantees no reuse even
-- across aborted transactions (the gaps that leaves are fine; reuse is
-- what's forbidden). Call inside the same transaction as the candidate
-- insert and retry on the unique-constraint conflict as the final arbiter.
--
-- SECURITY DEFINER: the sequence is created lazily on first use each year,
-- which requires CREATE privilege on the schema. The restricted app role
-- (see the audit_grants migration) is not granted that directly, so this
-- function runs with the privileges of its owner (the migration/superuser
-- role) instead of the caller's.
--
-- "CREATE SEQUENCE IF NOT EXISTS" alone is not race-free under true
-- concurrency — two callers can both pass the existence check before
-- either commits, and the loser gets a raw unique-violation on Postgres's
-- own catalog index instead of a clean no-op. Caught by a concurrency test
-- on a brand-new year sequence in an earlier slice; the fix (swallow the
-- race explicitly) is baked in here from the start rather than patched on.
CREATE OR REPLACE FUNCTION next_applicant_number() RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  seq_name text := 'applicant_number_seq_' || yr;
  n bigint;
BEGIN
  BEGIN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  EXCEPTION WHEN duplicate_table OR unique_violation THEN
    NULL;
  END;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN 'LVL-APP-' || yr || '-' || lpad(n::text, 5, '0');
END;
$$;
