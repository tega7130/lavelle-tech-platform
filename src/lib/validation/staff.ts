import { z } from "zod";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const EMAIL_MESSAGE = "Enter a valid email address";

export const staffSignInSchema = z.object({
  email: z.string().trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Staff password rules are stricter than candidates' (README A5 rule 4):
 * 10 characters, one capital, one number, one symbol. Exported as data,
 * not just a regex, so the set-password page's live checklist (the
 * mockup's four ticking requirements) and the server's final check read
 * the exact same rules — they can never silently drift apart.
 */
export const STAFF_PASSWORD_RULES = [
  { key: "length", label: "At least 10 characters", test: (p: string) => p.length >= 10 },
  { key: "capital", label: "One capital letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { key: "symbol", label: "One symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export function staffPasswordMeetsRules(password: string): boolean {
  return STAFF_PASSWORD_RULES.every((rule) => rule.test(password));
}

export const staffSetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().refine(staffPasswordMeetsRules, "Password does not meet all four requirements"),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
  });

export type StaffSetPasswordInput = z.infer<typeof staffSetPasswordSchema>;

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
