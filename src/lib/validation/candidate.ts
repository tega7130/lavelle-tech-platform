import { z } from "zod";

// Matches the prototype's own validation exactly (Handoff 01 README's
// validation table gives these as the authoritative messages) — a plain
// zod .email() is stricter/looser in different edge cases, so the shape
// check is a regex instead of zod's built-in.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const EMAIL_MESSAGE = "Enter a valid email address, e.g. you@firm.com";

const CURRENT_YEAR = new Date().getFullYear();

// FormData always carries checkbox values as the string "on" (or "true"
// when a client builds the FormData by hand, as the profile modal does) —
// never a real boolean. A bare z.boolean() silently rejects both and
// fails the whole parse, which is why every checkbox-backed field in this
// file goes through this instead.
const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(80, "Required"),
    lastName: z.string().trim().min(1, "Required").max(80, "Required"),
    email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
    phoneCountryCode: z.string().trim().min(1).default("+234"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || v.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
    terms: checkboxBoolean.refine((v) => v === true, "You must accept the Terms of Use to continue"),
    marketingOptIn: checkboxBoolean,
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// "Apply for this programme" checkout-first flow — deliberately smaller
// than registerSchema (no phone) since the whole point is a minimal form:
// name (for the certificate), email + password (for the account created
// on payment success). Terms acceptance is still mandatory — Candidate.
// acceptedTermsAt is NOT NULL and this is the only place that sets it for
// a guest checkout.
export const guestCheckoutSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(80, "Required"),
    lastName: z.string().trim().min(1, "Required").max(80, "Required"),
    email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
    terms: checkboxBoolean.refine((v) => v === true, "You must accept the Terms of Use to continue"),
    marketingOptIn: checkboxBoolean,
    programmeId: z.string().trim().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
  });

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

export const signInSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
  password: z.string().min(1, "Required"),
  remember: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
});

// Registration's two-step email-ownership check, ahead of the account
// itself existing (see EmailOtpChallenge).
export const requestOtpSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

// Profile modal — every field optional, Skip is always allowed (Handoff 01
// rule: "Profile completion is entirely optional").
export const updateProfileSchema = z
  .object({
    professionalStatus: z
      .enum(["PRACTISING_LAWYER", "INHOUSE_COUNSEL", "LAW_GRADUATE", "LAW_STUDENT", "REGULATED_NON_LAWYER", "OTHER"])
      .optional(),
    yearOfCall: z.coerce.number().int().min(1960).max(CURRENT_YEAR).optional(),
    scnNumber: z.string().trim().max(24).optional(),
    institution: z.string().trim().max(160).optional(),
    graduationYear: z.coerce
      .number()
      .int()
      .min(CURRENT_YEAR - 60)
      .max(CURRENT_YEAR + 8)
      .optional(),
    organisation: z.string().trim().max(160).optional(),
    roleTitle: z.string().trim().max(120).optional(),
    experienceBand: z.enum(["Y0_2", "Y3_5", "Y6_10", "Y10_PLUS"]).optional(),
    placeOfPractice: z.string().trim().max(160).optional(),
    photoUrl: z.string().trim().url().optional(),
    handbookAcknowledged: checkboxBoolean,
    /** Set by the modal's "Save profile" on step 3 — marks the checklist item complete. */
    complete: checkboxBoolean,
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateContactDetailsSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
});

export type UpdateContactDetailsInput = z.infer<typeof updateContactDetailsSchema>;

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline, per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
