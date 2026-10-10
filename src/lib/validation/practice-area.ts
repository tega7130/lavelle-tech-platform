import { z } from "zod";

// Short, stable, uppercase — this is embedded directly into every
// programme code under this practice area (LAV-[CODE]-[TIER]), so it is
// validated far more strictly than a free-text field: letters only, no
// spaces, no symbols, nothing that would need escaping anywhere this
// code appears (candidate-facing routes, certificates, exports).
export const practiceAreaCodeSchema = z
  .string({ error: "Enter a practice code" })
  .trim()
  .toUpperCase()
  .min(2, "Use at least 2 letters")
  .max(8, "Keep the practice code under 8 characters")
  .regex(/^[A-Z]+$/, "Letters only — no spaces, numbers or symbols");

export const createPracticeAreaSchema = z.object({
  name: z.string({ error: "Enter a practice area name" }).trim().min(1, "Enter a practice area name").max(120, "Keep the name under 120 characters"),
  code: practiceAreaCodeSchema,
});

export type CreatePracticeAreaInput = z.infer<typeof createPracticeAreaSchema>;
