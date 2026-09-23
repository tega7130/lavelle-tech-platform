/**
 * The 36 states plus the FCT, in the exact "<name>, Nigeria" form stored
 * in CandidateProfile.placeOfPractice — a fixed list rather than free text
 * so admin analytics (professional-analytics.ts's topLocations) can group
 * candidates by state without fuzzy-matching "Lagos" / "LAGOS" / "Lagos
 * State, Nigeria" as three different places. "Outside Nigeria" is a
 * deliberate escape hatch for the free-text case, not one of the 37.
 */
export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export const FCT_LABEL = "Abuja (FCT)";

export const OUTSIDE_NIGERIA = "Outside Nigeria";

/** Select options in display order — states A→Z, FCT after Zamfara, "Outside Nigeria" last as the free-text escape hatch. */
export const PRACTICE_LOCATION_OPTIONS: { value: string; label: string }[] = [
  ...NIGERIA_STATES.map((s) => ({ value: `${s}, Nigeria`, label: s })),
  { value: `${FCT_LABEL}, Nigeria`, label: FCT_LABEL },
  { value: OUTSIDE_NIGERIA, label: OUTSIDE_NIGERIA },
];
