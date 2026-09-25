import type { TourStop } from "@/components/portal/product-tour";

/** First-time applicant walkthrough — every nav item usable before enrolling. Gated items (Programme, Deadlines, Assessment, Notes, Lavelle AI) are deliberately excluded; see ENROLLED_FEATURES_TOUR_STEPS. */
export const ONBOARDING_TOUR_STEPS: TourStop[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: "Your dashboard",
    body: "Your home base — see your applicant number, profile progress, and what to do next at a glance.",
  },
  {
    target: '[data-tour="nav-catalogue"]',
    title: "Catalogue",
    body: "Browse every programme by specialization and tier, and enrol when you're ready. This is usually the first stop.",
  },
  {
    target: '[data-tour="nav-library"]',
    title: "Document Library",
    body: "Purchase drafting templates and reference materials — available independently of any programme enrolment.",
  },
  {
    target: '[data-tour="nav-exams"]',
    title: "Exams",
    body: "Register for a certifying examination — you can sit one even without enrolling in a full programme.",
  },
  {
    target: '[data-tour="nav-credentials"]',
    title: "Credentials",
    body: "Every certificate you earn, and its public verification link, lives here once issued.",
  },
  {
    target: '[data-tour="nav-profile"]',
    title: "Profile & ID",
    body: "Your identity details, photo, and Candidate ID card — keep this up to date.",
  },
  {
    target: '[data-tour="nav-support"]',
    title: "Contact us",
    body: "Questions about registration, payment, or anything else — reach the registrar's office from here.",
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
