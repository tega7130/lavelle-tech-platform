/** Human-readable labels for Azubi enum/tag values, shared across admin pages that display them. */

export const AZUBI_AREA_LABELS: Record<string, string> = {
  corporate_commercial: "Corporate and commercial",
  litigation_dispute: "Litigation and dispute resolution",
  property_land: "Property and land",
  research_policy: "Research and policy",
  other: "Other",
};

export const AZUBI_PIPELINE_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  STATUS_CONFIRMED: "Status confirmed",
  MATCHED: "Matched",
  PLACED: "Placed",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export const AZUBI_STATUS_KIND_LABELS: Record<string, string> = {
  STUDENT: "Law student",
  AWAITING_CALL: "Awaiting call to the Bar",
  CALLED: "Called to the Bar",
};

export const AZUBI_WORKING_MODE_LABELS: Record<string, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  ONLINE: "Online",
};
