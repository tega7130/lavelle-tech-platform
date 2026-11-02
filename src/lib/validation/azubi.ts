import { z } from "zod";
import { AZUBI_COUNTRIES } from "@/lib/azubi/countries";

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Current privacy notice version applicants/enquirers consent to (build brief section 6). */
export const AZUBI_PRIVACY_VERSION = "1";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const emailField = z.string().trim().min(1, "Enter your email address").regex(EMAIL_RE, "Enter a valid email address").max(254);

// Never trust a client checkbox value directly — FormData sends "on"/"true"/missing, not a boolean.
const consentField = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true)
  .pipe(z.literal(true, { error: "You must agree before submitting" }));

// Honeypot: real visitors never see or fill this field; a filled value means a bot.
const honeypotField = z.string().max(0, "Submission rejected").optional().default("");

const VALID_DIAL_CODES = new Set(AZUBI_COUNTRIES.map((c) => c.dial));

/** A dial-code select + a local-number input, combined into one stored phone string. */
const phoneFields = {
  phoneDialCode: z.string().refine((v) => VALID_DIAL_CODES.has(v), "Choose a valid country code"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Enter your phone number")
    .transform((v) => v.replace(/[^\d]/g, ""))
    .pipe(z.string().min(4, "Enter a valid phone number").max(15, "Enter a valid phone number")),
};

const COUNTRY_NAMES = AZUBI_COUNTRIES.map((c) => c.name);
const countryField = z.enum(COUNTRY_NAMES as [string, ...string[]], { error: "Choose your country" });

const STATUS_KIND_MAP = {
  student: "STUDENT",
  awaiting_call: "AWAITING_CALL",
  called: "CALLED",
} as const;

const WORKING_MODE_MAP = {
  onsite: "ONSITE",
  hybrid: "HYBRID",
  online: "ONLINE",
} as const;

const AREA_VALUES = ["corporate_commercial", "litigation_dispute", "property_land", "research_policy", "other"] as const;

export const azubiApplicationSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name").max(160),
    email: emailField,
    ...phoneFields,
    country: countryField,
    state: z.string().trim().min(1, "Enter your state of residence").max(80),
    statusKind: z.enum(Object.keys(STATUS_KIND_MAP) as [keyof typeof STATUS_KIND_MAP, ...Array<keyof typeof STATUS_KIND_MAP>], {
      error: "Choose your current status",
    }).transform((v) => STATUS_KIND_MAP[v]),
    institution: z.string().trim().min(1, "Enter your university or law school").max(200),
    workingMode: z.enum(Object.keys(WORKING_MODE_MAP) as [keyof typeof WORKING_MODE_MAP, ...Array<keyof typeof WORKING_MODE_MAP>], {
      error: "Choose a working mode",
    }).transform((v) => WORKING_MODE_MAP[v]),
    areas: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .pipe(z.array(z.enum(AREA_VALUES)).min(1, "Choose at least one area")),
    otherAreaDetail: z.string().trim().max(200).optional().or(z.literal("")),
    statement: z.string().trim().min(1, "Tell us why you want to join").max(1500, "Keep this under 1,500 characters"),
    consent: consentField,
    companyWebsite: honeypotField,
  })
  .transform((data) => {
    const { phoneDialCode, phoneNumber, ...rest } = data;
    return { ...rest, phone: `${phoneDialCode} ${phoneNumber}` };
  })
  .superRefine((data, ctx) => {
    if (data.areas.includes("other") && !data.otherAreaDetail?.trim()) {
      ctx.addIssue({ code: "custom", path: ["otherAreaDetail"], message: "Tell us what other area you mean" });
    }
  });
export type AzubiApplicationInput = z.infer<typeof azubiApplicationSchema>;

const WRITING_AS_MAP = {
  "A prospective fellow": "FELLOW",
  "A law firm or legal organisation": "HOST",
  "Another organisation": "OTHER_ORG",
  "Something else": "OTHER",
} as const;

export const azubiEnquirySchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name").max(160),
    email: emailField,
    ...phoneFields,
    organisation: z.string().trim().max(160).optional().or(z.literal("")),
    writingAs: z.enum(Object.keys(WRITING_AS_MAP) as [keyof typeof WRITING_AS_MAP, ...Array<keyof typeof WRITING_AS_MAP>], {
      error: "Choose who you are writing as",
    }).transform((v) => WRITING_AS_MAP[v]),
    message: z.string().trim().min(1, "Enter a message").max(4000, "Keep this under 4,000 characters"),
    consent: consentField,
    companyWebsite: honeypotField,
    source: z.enum(["CONTACT_PAGE", "HOME_FORM"]),
  })
  .transform((data) => {
    const { phoneDialCode, phoneNumber, ...rest } = data;
    return { ...rest, phone: `${phoneDialCode} ${phoneNumber}` };
  });
export type AzubiEnquiryInput = z.infer<typeof azubiEnquirySchema>;
