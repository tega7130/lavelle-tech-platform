-- Fix: nextval() takes a text/regclass argument, not a bare identifier.
-- %I quoted it as an identifier, which Postgres then tried to resolve as
-- a column reference ("column ... does not exist"). %L (string literal)
-- is correct here.
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
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO n;
  RETURN 'LVL-APP-' || yr || '-' || lpad(n::text, 5, '0');
END;
$$;
