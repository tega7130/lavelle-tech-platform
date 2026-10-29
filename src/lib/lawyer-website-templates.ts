/**
 * The curated catalogue of templates, color themes and font pairings a
 * lawyer can choose for their site — a fixed, code-defined list (same
 * convention as ROLE_PRESETS in permissions.ts or nigeria-locations.ts),
 * not a database table, since these are platform-curated options, not
 * user-editable data.
 *
 * Phase 5 scaffolding: every template is FREE for now — there's nothing
 * real to charge for yet. The `tier` field exists so Phase 6 can flip a
 * specific template to PAID later without any schema or registry-shape
 * change, only this constant.
 *
 * These are deliberately plain placeholders, not final visual designs —
 * per the standing instruction not to invent those before real
 * references are provided. Swapping a template's actual look later
 * means changing LAYOUT_CLASSES below and/or LawyerSiteView's JSX; the
 * registry keys, the picker UI, and every site's stored selection stay
 * exactly as they are.
 */

export type LawyerWebsiteTemplateTier = "FREE" | "PAID";

export interface LawyerWebsiteTemplateMeta {
  key: string;
  name: string;
  tier: LawyerWebsiteTemplateTier;
  description: string;
}

export const LAWYER_WEBSITE_TEMPLATES: LawyerWebsiteTemplateMeta[] = [
  { key: "classic", name: "Classic", tier: "FREE", description: "Centred name, a quiet divider, generous spacing." },
  { key: "modern", name: "Modern", tier: "FREE", description: "Bold left-aligned name with a coloured accent bar." },
  { key: "minimal", name: "Minimal", tier: "FREE", description: "Small, understated name and plenty of whitespace." },
];

export const DEFAULT_TEMPLATE_KEY = "classic";

// Each pair is a Tailwind 700/800-weight shade against a white
// background — a safe, widely-used heuristic for WCAG AA body-text
// contrast, not a value individually measured here. Revisit with real
// contrast tooling once real template art replaces these.
export interface LawyerWebsiteColorThemeMeta {
  key: string;
  name: string;
  primary: string; // headings
  accent: string; // links, tags, accents
}

export const LAWYER_WEBSITE_COLOR_THEMES: LawyerWebsiteColorThemeMeta[] = [
  { key: "navy-gold", name: "Navy & Gold", primary: "#1e293b", accent: "#b45309" },
  { key: "forest", name: "Forest", primary: "#1f2937", accent: "#15803d" },
  { key: "burgundy", name: "Burgundy", primary: "#1f1f1f", accent: "#9f1239" },
  { key: "slate", name: "Slate", primary: "#18181b", accent: "#475569" },
];

export const DEFAULT_COLOR_THEME_KEY = "navy-gold";

// Combinations of fonts already available with zero extra loading —
// var(--font-poppins) is loaded once, globally, in the root layout;
// the others are generic stacks. Deliberately not pulling in further
// Google Fonts here (real template art will likely want real font
// choices, which belongs with that work, not this scaffolding).
export interface LawyerWebsiteFontPairingMeta {
  key: string;
  name: string;
  headingFont: string;
  bodyFont: string;
}

export const LAWYER_WEBSITE_FONT_PAIRINGS: LawyerWebsiteFontPairingMeta[] = [
  { key: "modern-sans", name: "Modern Sans", headingFont: "var(--font-poppins), system-ui, sans-serif", bodyFont: "system-ui, sans-serif" },
  { key: "classic-serif", name: "Classic Serif", headingFont: "Georgia, 'Times New Roman', serif", bodyFont: "Georgia, 'Times New Roman', serif" },
  { key: "clean-minimal", name: "Clean Minimal", headingFont: "system-ui, sans-serif", bodyFont: "system-ui, sans-serif" },
];

export const DEFAULT_FONT_PAIRING_KEY = "modern-sans";

export function getTemplateMeta(key: string | null | undefined): LawyerWebsiteTemplateMeta {
  return LAWYER_WEBSITE_TEMPLATES.find((t) => t.key === key) ?? LAWYER_WEBSITE_TEMPLATES.find((t) => t.key === DEFAULT_TEMPLATE_KEY)!;
}

export function getColorThemeMeta(key: string | null | undefined): LawyerWebsiteColorThemeMeta {
  return LAWYER_WEBSITE_COLOR_THEMES.find((t) => t.key === key) ?? LAWYER_WEBSITE_COLOR_THEMES.find((t) => t.key === DEFAULT_COLOR_THEME_KEY)!;
}

export function getFontPairingMeta(key: string | null | undefined): LawyerWebsiteFontPairingMeta {
  return LAWYER_WEBSITE_FONT_PAIRINGS.find((t) => t.key === key) ?? LAWYER_WEBSITE_FONT_PAIRINGS.find((t) => t.key === DEFAULT_FONT_PAIRING_KEY)!;
}
