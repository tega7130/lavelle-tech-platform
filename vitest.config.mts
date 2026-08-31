import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    // 5000ms default assumed a local Postgres instance (see the
    // fileParallelism comment below) — DATABASE_URL now points at a
    // remote Supabase pooler, where round-trip latency alone can eat
    // that whole budget on tests doing several sequential queries.
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
