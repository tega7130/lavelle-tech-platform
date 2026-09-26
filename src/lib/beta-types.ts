import type { BetaFeature, BetaFeedbackKind } from "@/generated/prisma/client";

// Same discipline as src/lib/permissions.ts: re-exporting a Prisma-generated
// enum as a VALUE (not just a type) crashes Turbopack in any "use client"
// component that imports it, even transitively ("chunking context does not
// support external modules (request: node:module)"), in both `next dev` and
// `next build`. Types only from here; values are plain string literals cast
// to the enum's type. Server code (actions, beta-gate.ts) imports the real
// enum object directly from "@/generated/prisma/client" instead.
export type { BetaFeature, BetaFeedbackKind };

export const BETA_FEATURE = {
  PROGRAMME: "PROGRAMME" as BetaFeature,
  DOCUMENT_LIBRARY: "DOCUMENT_LIBRARY" as BetaFeature,
};

export const BETA_FEEDBACK_KIND = {
  COMPLETION: "COMPLETION" as BetaFeedbackKind,
  WAITLIST_INTEREST: "WAITLIST_INTEREST" as BetaFeedbackKind,
};
