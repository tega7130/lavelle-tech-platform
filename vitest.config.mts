import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Loads .env then .env.local (override), same precedence Next.js
    // itself uses — so DATABASE_URL always resolves to local Postgres
    // here regardless of what .env alone holds (that's the production
    // Supabase instance; tests must never write there). See the file's
    // own comment for the incident that made this non-negotiable.
    setupFiles: ["./tests/env-setup.ts"],
    // Generous headroom for a DB-backed suite with sequential queries per
    // test; harmless overkill now that DATABASE_URL is local Postgres.
    testTimeout: 20000,
    // Every test file shares the one real local Postgres database (no
    // per-file isolation) — Vitest's default cross-file parallelism is
    // safe as long as no test mutates genuinely global singleton state.
    // The Slice 07 certificate-template tests are the first to do that
    // (temporarily deactivating every active CertificateTemplate to
    // exercise the "no active template" path), which raced concurrently
    // running files that expect an active template to exist. Sequential
    // file execution removes that whole class of race going forward.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
