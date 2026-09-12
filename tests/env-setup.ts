import { config } from "dotenv";

/**
 * Same precedence Next.js itself uses (.env then .env.local override) —
 * deliberately NOT just "dotenv/config", which only loads .env and would
 * point the test suite at whatever DATABASE_URL .env holds. That was the
 * production Supabase instance, so every DB-backed test run was writing
 * fixture data straight into production. .env.local's local Postgres
 * DATABASE_URL/MIGRATE_DATABASE_URL now always win here.
 */
config({ path: ".env" });
config({ path: ".env.local", override: true });
