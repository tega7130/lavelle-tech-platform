/**
 * Fails a production build while any Azubi legal-page placeholder (see
 * src/lib/azubi/placeholders.ts) still holds its "[... to confirm ...]"
 * default — those need legal/ops sign-off before launch (build brief
 * section 5). Set ALLOW_AZUBI_PLACEHOLDERS=true for preview builds.
 */
import { AZUBI_PLACEHOLDERS } from "../src/lib/azubi/placeholders";

if (process.env.ALLOW_AZUBI_PLACEHOLDERS === "true") {
  console.log("[azubi] Skipping placeholder check (ALLOW_AZUBI_PLACEHOLDERS=true).");
  process.exit(0);
}

const unresolved = Object.entries(AZUBI_PLACEHOLDERS).filter(([, value]) => /^\[.*\]$/.test(value.trim()));

if (unresolved.length > 0) {
  console.error("\n[azubi] Build blocked: unresolved legal placeholders in src/lib/azubi/placeholders.ts:\n");
  for (const [key, value] of unresolved) {
    console.error(`  - ${key}: ${value}`);
  }
  console.error(
    "\nResolve these with legal/ops before a production launch, or set ALLOW_AZUBI_PLACEHOLDERS=true for preview builds.\n"
  );
  process.exit(1);
}

console.log("[azubi] All legal placeholders resolved.");
