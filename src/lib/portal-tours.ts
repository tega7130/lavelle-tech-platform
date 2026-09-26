import type { TourStop } from "@/components/portal/product-tour";

/**
 * A single, focused nudge — not a full nav walkthrough — shown once the
 * welcome screen and profile wizard conclude (saved or skipped). Points
 * straight at Catalogue: enrolling in a programme is the primary reason a
 * candidate registers in the first place, so this replaces an earlier
 * 7-stop tour of every nav item, which diluted that with items (Document
 * Library, Exams, Credentials, Profile & ID, Contact us) that weren't the
 * point of this particular moment.
 */
export const CATALOGUE_NUDGE_STEPS: TourStop[] = [
  {
    target: '[data-tour="nav-catalogue"]',
    title: "Choose your first programme",
    body: "Browse the catalogue by specialization and tier, and enrol when you're ready — this is where your practice specialization begins.",
  },
];

/** Fires once, the first time a candidate reaches the dashboard after enrolling — points at the items enrolment just unlocked. */
export const ENROLLED_FEATURES_TOUR_STEPS: TourStop[] = [
  {
    target: '[data-tour="nav-programme"]',
    title: "Programme",
    body: "Your enrolled programme's modules and lectures — this is where you'll spend most of your time now.",
  },
  {
    target: '[data-tour="nav-deadlines"]',
    title: "Deadlines",
    body: "Every module and assessment deadline for your cohort, in one place.",
  },
  {
    target: '[data-tour="nav-assessment"]',
    title: "Assessment",
    body: "Drafting exercises and quizzes for your current module land here, along with faculty feedback once marked.",
  },
  {
    target: '[data-tour="nav-notes"]',
    title: "Notes",
    body: "Notes you take while watching a lecture are saved here automatically, organised by module.",
  },
];
