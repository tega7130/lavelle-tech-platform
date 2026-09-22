import { NIGERIA_STATES, FCT_LABEL } from "@/lib/nigeria-locations";

// Common misspellings/shorthand seen in real free-text data, mapped to the
// canonical state they mean — deliberately a short, hand-verified list
// rather than generic fuzzy/edit-distance matching, which risks silently
// conflating two different short state names (e.g. Edo/Oyo/Imo are all
// 3 letters, one edit apart from each other).
const KNOWN_ALIASES: Record<string, string> = {
  logos: "Lagos",
  fct: FCT_LABEL,
  abuja: FCT_LABEL,
  "federal capital territory": FCT_LABEL,
};

const CANONICAL_NAMES = [...NIGERIA_STATES, FCT_LABEL];

/**
 * Maps a raw, free-text placeOfPractice value to the canonical
 * "<State>, Nigeria" form the new dropdown writes (nigeria-locations.ts) —
 * or null when nothing can be confidently determined, in which case the
 * original value is left untouched rather than guessed at.
 *
 * Confident cases only:
 *  1. Already canonical (possibly different casing/whitespace).
 *  2. The state name alone, with or without a "State"/"Nigeria" suffix,
 *     in any casing ("Lagos", "lagos state", "LAGOS, NIGERIA").
 *  3. A short hand-verified alias list (typos, "Abuja" for the FCT).
 * Anything else (a foreign location, a state name buried in a longer
 * free-text sentence, genuine ambiguity) returns null.
 */
export function normalizePlaceOfPractice(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip a trailing ", Nigeria" / " Nigeria", then a trailing " State".
  let core = trimmed.replace(/,?\s*nigeria\s*$/i, "").trim();
  core = core.replace(/\s+state\s*$/i, "").trim();
  const key = core.toLowerCase();

  if (KNOWN_ALIASES[key]) return `${KNOWN_ALIASES[key]}, Nigeria`;

  const match = CANONICAL_NAMES.find((name) => name.toLowerCase() === key);
  if (match) return `${match}, Nigeria`;

  return null;
}
