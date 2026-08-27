/**
 * Instrumentation file for server startup.
 * Next.js automatically runs this file when the server starts.
 * Used to initialize background jobs, scheduled tasks, etc.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only initialize scheduler on Node.js runtime (not Edge Runtime)
    const { startScheduler } = await import("./src/lib/scheduler");

    try {
      console.log("[instrumentation] Starting email scheduler...");
      startScheduler();
      console.log("[instrumentation] Email scheduler started successfully");
    } catch (error) {
      console.error("[instrumentation] Failed to start email scheduler:", error);
      // Don't crash the server if scheduler fails to start
    }
  }
}
