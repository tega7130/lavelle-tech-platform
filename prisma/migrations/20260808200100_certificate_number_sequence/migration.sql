-- Certificate number generator: LVL-CERT-2026-01188, one Postgres sequence
-- per calendar year — the same SECURITY DEFINER lazy-sequence pattern as
-- next_applicant_number() / next_candidate_number(). Never COUNT(*)
-- (rule 3: certificateNumber is permanent and never reused, and a count
-- would collide the moment any certificate is ever deleted or the count
-- raced concurrently).
CREATE OR REPLACE FUNCTION next_certificate_number() RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  seq_name text := 'certificate_number_seq_' || yr;
  n bigint;
BEGIN
  BEGIN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  EXCEPTION WHEN duplicate_table OR unique_violation THEN
    NULL;
  END;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN 'LVL-CERT-' || yr || '-' || lpad(n::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_certificate_number() TO lavelle_app;
