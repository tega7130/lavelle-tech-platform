// Vitest runs outside Next's webpack/turbopack build, which is what
// normally aliases the real "server-only" package (which throws
// unconditionally) to a no-op for server bundles. This mirrors that
// aliasing for tests — see vitest.config.ts.
export {};
