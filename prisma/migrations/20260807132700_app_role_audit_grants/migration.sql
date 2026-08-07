-- Restricted application role. The app connects as this role at runtime
-- (DATABASE_URL) instead of the migration/superuser role
-- (MIGRATE_DATABASE_URL), so a DB-level grant restriction actually means
-- something — "the UI states the audit log is immutable; make that true
-- in the database, not just the service layer" (Handoff 01 README).
--
-- Idempotent: safe to re-run against a database that already has the role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lavelle_app') THEN
    CREATE ROLE lavelle_app LOGIN PASSWORD 'CHANGEME_LAVELLE_APP_DEV_PASSWORD';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO lavelle_app;

-- Full CRUD on every table except audit_event, plus USAGE on sequences
-- (bigserial ids, the applicant-number sequences created by
-- next_applicant_number(), which is SECURITY DEFINER and so does not
-- itself require sequence USAGE for the caller).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lavelle_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lavelle_app;
GRANT EXECUTE ON FUNCTION next_applicant_number() TO lavelle_app;

-- audit_event is append-only: no UPDATE, no DELETE, ever, for the app role.
REVOKE UPDATE, DELETE ON audit_event FROM lavelle_app;

-- Keep future tables/sequences from silently reopening this — anything
-- this migration's own role creates going forward defaults the same way.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lavelle_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lavelle_app;
