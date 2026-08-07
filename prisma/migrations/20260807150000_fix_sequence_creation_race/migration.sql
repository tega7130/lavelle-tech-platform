-- Fix: "CREATE SEQUENCE IF NOT EXISTS" is not actually race-free under
-- true concurrency — two callers can both pass the existence check
-- before either commits, and the loser gets a raw unique-violation on
-- Postgres's own catalog index (pg_class_relname_nsp_index) instead of a
-- clean "already exists" no-op. Caught by the concurrency test on a
-- brand-new year sequence (25 concurrent first-ever calls for 2026).
-- Swallow the race explicitly instead of relying on IF NOT EXISTS alone.
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
    -- Another concurrent caller created it a moment earlier — fine, it
    -- exists now either way, carry on to nextval().
    NULL;
  END;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN 'LVL-APP-' || yr || '-' || lpad(n::text, 5, '0');
END;
$$;
