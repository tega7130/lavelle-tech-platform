-- Switches the printed certificate-number format from LVL-CERT-2026-01188
-- to LAV-TILL 2026/001, per the new default certificate design. Reuses
-- the SAME per-year sequence objects (certificate_number_seq_YYYY) that
-- next_certificate_number() has always used — this is a pure formatting
-- change, not a new numbering system: the running count for the current
-- year continues from wherever it already is, so an already-issued
-- certificate's number (old format) is never revisited or reused, and a
-- newly-issued one for the same year picks up the sequence where the old
-- format left off. Padding is a MINIMUM of 3 digits (lpad only pads, it
-- never truncates), so the 1000th certificate in a year prints as
-- "1000", not "000".
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
  RETURN 'LAV-TILL ' || yr || '/' || lpad(n::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_certificate_number() TO lavelle_app;
