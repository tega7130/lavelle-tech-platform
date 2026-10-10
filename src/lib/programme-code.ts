import type { ProgrammeTier } from "@/generated/prisma/client";

// Not server-only, deliberately — this is pure, deterministic string
// logic with no secrets or DB access, and the admin create/duplicate
// forms import it directly for a live "here's the code you'll get"
// preview that must match the server's own generation exactly.

/**
 * 01 = Foundation, 02 = Intermediate (this codebase's SPECIALIST tier),
 * 03 = Advanced — a fixed, meaningful mapping, never a generic
 * incrementing sequence. Adding a fourth tier is a deliberate
 * architecture change (new enum value + an entry here), not something
 * this map silently absorbs.
 */
export const TIER_CODE_NUMBER: Record<ProgrammeTier, string> = {
  FOUNDATION: "01",
  SPECIALIST: "02",
  ADVANCED_PRACTITIONER: "03",
};

/**
 * LAV-[PRACTICE]-[TIER] — deterministic from the practice area's own
 * short code plus tier alone, never from the programme's (changeable)
 * title. The practice code is trusted as already validated/normalised
 * (practiceAreaCodeSchema) by the time it reaches here.
 */
export function generateProgrammeCode(practiceCode: string, tier: ProgrammeTier): string {
  return `LAV-${practiceCode}-${TIER_CODE_NUMBER[tier]}`;
}
