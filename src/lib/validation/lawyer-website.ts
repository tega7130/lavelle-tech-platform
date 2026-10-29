import { z } from "zod";

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

export const startLawyerWebsiteSchema = z
  .object({
    entityType: z.enum(["INDIVIDUAL", "LAW_FIRM"], { error: "Choose how you want to present your site" }),
    firmName: z.string().trim().max(160, "Keep the firm name under 160 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entityType === "LAW_FIRM" && !data.firmName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["firmName"], message: "Enter your firm's name" });
    }
  });
export type StartLawyerWebsiteInput = z.infer<typeof startLawyerWebsiteSchema>;

// entityType is read off the existing site, not resubmitted here, so the
// conditional requirement below always checks against the real value —
// never a value the client could spoof to skip the other branch.
export const updateLawyerWebsiteVerificationSchema = z
  .object({
    entityType: z.enum(["INDIVIDUAL", "LAW_FIRM"]),
    scnNumber: z.string().trim().max(24).optional(),
    idCardEvidenceAssetId: z.string().optional(),
    cacNumber: z.string().trim().max(40).optional(),
    firmEvidenceAssetId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entityType === "INDIVIDUAL" && !data.scnNumber?.trim() && !data.idCardEvidenceAssetId) {
      ctx.addIssue({ code: "custom", path: ["scnNumber"], message: "Enter your SCN number, or upload a photo of your ID card" });
    }
    if (data.entityType === "LAW_FIRM" && !data.cacNumber?.trim()) {
      ctx.addIssue({ code: "custom", path: ["cacNumber"], message: "Enter your CAC/business registration number" });
    }
  });
export type UpdateLawyerWebsiteVerificationInput = z.infer<typeof updateLawyerWebsiteVerificationSchema>;

export const acknowledgeConductDisclaimerSchema = z.object({
  acknowledged: z.literal("true", { error: "You must accept the disclaimer to continue" }),
});

export const updateLawyerWebsiteAboutSchema = z.object({
  introText: z.string().trim().max(2000, "Keep this under 2000 characters").optional(),
  biographyText: z.string().trim().max(8000, "Keep this under 8000 characters").optional(),
  personalStatementText: z.string().trim().max(4000, "Keep this under 4000 characters").optional(),
  careerJourneyText: z.string().trim().max(8000, "Keep this under 8000 characters").optional(),
  personalInterestsText: z.string().trim().max(2000, "Keep this under 2000 characters").optional(),
});
export type UpdateLawyerWebsiteAboutInput = z.infer<typeof updateLawyerWebsiteAboutSchema>;

const currentYear = new Date().getFullYear();

export const addQualificationSchema = z
  .object({
    source: z.enum(["MANUAL", "LAVELLE_CERTIFICATE"], { error: "Choose how to add this qualification" }),
    title: z.string().trim().max(200, "Keep the title under 200 characters").optional(),
    issuer: z.string().trim().max(160, "Keep this under 160 characters").optional(),
    year: z.coerce.number().int().min(1950).max(currentYear).optional(),
    certificateId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === "MANUAL" && !data.title?.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Enter a title for this qualification" });
    }
    if (data.source === "LAVELLE_CERTIFICATE" && !data.certificateId) {
      ctx.addIssue({ code: "custom", path: ["certificateId"], message: "Choose a certificate to connect" });
    }
  });
export type AddQualificationFormInput = z.infer<typeof addQualificationSchema>;

export const updateQualificationSchema = z.object({
  title: z.string({ error: "Enter a title" }).trim().min(1, "Enter a title").max(200, "Keep the title under 200 characters"),
  issuer: z.string().trim().max(160, "Keep this under 160 characters").optional(),
  year: z.coerce.number().int().min(1950).max(currentYear).optional(),
});

export const experienceSchema = z
  .object({
    organisation: z.string({ error: "Enter the organisation" }).trim().min(1, "Enter the organisation").max(160),
    roleTitle: z.string({ error: "Enter your role" }).trim().min(1, "Enter your role").max(120),
    startYear: z.coerce.number({ error: "Enter a start year" }).int().min(1950).max(currentYear),
    endYear: z.coerce.number().int().min(1950).max(currentYear + 1).optional(),
    isCurrent: z.enum(["true", "false"]).transform((v) => v === "true"),
    description: z.string().trim().max(4000, "Keep this under 4000 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isCurrent && data.endYear !== undefined && data.endYear < data.startYear) {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year can't be before the start year" });
    }
  });
export type ExperienceFormInput = z.infer<typeof experienceSchema>;

export const publicationSchema = z
  .object({
    kind: z.enum(["EXTERNAL_LINK", "NATIVE_ARTICLE"], { error: "Choose a publication type" }),
    title: z.string({ error: "Enter a title" }).trim().min(1, "Enter a title").max(200),
    externalUrl: z.string().trim().max(2000).optional(),
    excerpt: z.string().trim().max(300, "Keep the excerpt under 300 characters").optional(),
    body: z.string().trim().max(20000, "Keep this under 20000 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "EXTERNAL_LINK") {
      if (!data.externalUrl?.trim()) {
        ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Enter a link to the publication" });
      } else if (!/^https?:\/\//i.test(data.externalUrl.trim())) {
        ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Enter a full link, starting with https://" });
      }
    }
  });
export type PublicationFormInput = z.infer<typeof publicationSchema>;

// The "must represent your own name" check needs the candidate's real
// name/firm name, which this schema doesn't have — that semantic check
// happens in updateLawyerWebsiteHandle itself. This only validates shape.
export const updateHandleSchema = z.object({
  handle: z
    .string({ error: "Enter a website address" })
    .trim()
    .min(3, "Use at least 3 characters")
    .max(80, "Keep it under 80 characters")
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i, "Letters, numbers and hyphens only"),
});

export const activitySchema = z.object({
  title: z.string({ error: "Enter a title" }).trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(2000, "Keep this under 2000 characters").optional(),
  year: z.coerce.number().int().min(1950).max(currentYear).optional(),
});
export type ActivityFormInput = z.infer<typeof activitySchema>;

// Mandatory reason on reject/takedown — same convention as
// unpublishBlogPost's reason parameter and Staff.suspendedReason.
export const reasonSchema = z.object({
  reason: z.string({ error: "Enter a reason" }).trim().min(10, "Give at least a short reason (10+ characters)").max(2000),
});

// Shape only — whether a key actually exists in the registry, and
// whether a template is available on the candidate's plan, is checked in
// updateLawyerWebsiteLookAndFeel itself, which has the registry.
export const updateLookAndFeelSchema = z.object({
  templateKey: z.string({ error: "Choose a template" }).min(1),
  colorThemeKey: z.string({ error: "Choose a color theme" }).min(1),
  fontPairingKey: z.string({ error: "Choose a font pairing" }).min(1),
});
