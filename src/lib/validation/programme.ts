import { z } from "zod";

// Free-form — the admin can enter whatever code they want. The only hard
// rule is "/" (it becomes a URL path segment in candidate-facing routes
// like /portal/exams/[code], and a slash would split it into two).
//
// The `error` option on the base type constructor (not a chained
// .min()/.positive()) is what catches a field that's MISSING entirely
// (undefined), not just present-but-empty — zod's base type check runs
// before any chained refinement, so a message attached only to .min(1,
// "...") never fires for a field the form omitted altogether (same
// pattern as validation/payment.ts's offlinePaymentInputSchema).
export const programmeCodeSchema = z
  .string({ error: "Enter a programme code" })
  .trim()
  .min(1, "Enter a programme code")
  .max(40, "Keep the code under 40 characters")
  .refine((v) => !v.includes("/"), { message: "The code cannot contain a slash" });

// Base object kept separate from its .refine()s so updateProgrammeSchema
// can derive a .partial() version below — .partial() only exists on a
// plain ZodObject, not on the ZodEffects a chained .refine() produces.
const programmeObjectSchema = z.object({
  title: z.string({ error: "Enter a programme title" }).trim().min(1, "Enter a programme title").max(200, "Keep the title under 200 characters"),
  code: programmeCodeSchema,
  categoryId: z.string().min(1).optional(),
  newCategoryName: z.string().trim().min(1).max(120).optional(),
  tier: z.enum(["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"], { error: "Choose a tier" }),
  summary: z.string({ error: "Enter a short summary" }).trim().min(1, "Enter a short summary"),
  authorName: z.string().trim().max(120).optional(),
  weeks: z.coerce.number({ error: "Enter the number of weeks" }).int("Enter a whole number of weeks").positive("Enter a whole number of weeks greater than zero"),
  weeklyHoursLabel: z.string({ error: "Enter the expected weekly hours" }).trim().min(1, "Enter the expected weekly hours"),
  // Fee arrives from the form as naira (a human types "450000"); the
  // server converts to kobo — feeMinor itself is never entered directly,
  // so a decimal typo can't silently become a 100x-off integer.
  feeNaira: z.coerce.number({ error: "Enter the programme fee" }).positive("Fee must be greater than zero"),
  currency: z.string().trim().min(1).default("NGN"),
  deliveryLabel: z.string().trim().min(1).default("Online + proctored exam"),
  prerequisiteTier: z.enum(["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"]).optional(),
  // Candidate-facing explainer video — a pasted hosted URL (e.g. YouTube)
  // or an uploaded asset, mutually exclusive at the UI level, same
  // either/or shape as Lecture.videoUrl/videoAssetId.
  coverVideoUrl: z.string().trim().url().optional(),
  coverVideoAssetId: z.string().nullable().optional(),
});

function requiresCategory(data: { categoryId?: string; newCategoryName?: string }) {
  return !!(data.categoryId || data.newCategoryName);
}
function prerequisiteOnlyForAdvanced(data: { tier?: string; prerequisiteTier?: string }) {
  return data.tier === "ADVANCED_PRACTITIONER" || !data.prerequisiteTier;
}

export const createProgrammeSchema = programmeObjectSchema
  .refine(requiresCategory, { message: "Choose a category or create one", path: ["categoryId"] })
  .refine(prerequisiteOnlyForAdvanced, {
    message: "Only Advanced Practitioner programmes take a prerequisite tier",
    path: ["prerequisiteTier"],
  });

export type CreateProgrammeInput = z.infer<typeof createProgrammeSchema>;

export const updateProgrammeSchema = programmeObjectSchema
  .partial()
  .extend({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional() })
  .refine(prerequisiteOnlyForAdvanced, {
    message: "Only Advanced Practitioner programmes take a prerequisite tier",
    path: ["prerequisiteTier"],
  });

export type UpdateProgrammeInput = z.infer<typeof updateProgrammeSchema>;

export const assessmentWeightsSchema = z
  .object({
    quiz: z.coerce.number({ error: "Enter the quiz weight" }).int("Enter a whole number").min(0, "Enter a percentage between 0 and 100").max(100, "Enter a percentage between 0 and 100"),
    drafting: z.coerce.number({ error: "Enter the drafting weight" }).int("Enter a whole number").min(0, "Enter a percentage between 0 and 100").max(100, "Enter a percentage between 0 and 100"),
    examination: z.coerce.number({ error: "Enter the examination weight" }).int("Enter a whole number").min(0, "Enter a percentage between 0 and 100").max(100, "Enter a percentage between 0 and 100"),
  })
  .refine((w) => w.quiz + w.drafting + w.examination === 100, {
    message: "Assessment weights must total exactly 100",
  });

export const moduleInputSchema = z.object({
  weekNumber: z.coerce.number({ error: "Enter a week number" }).int("Enter a whole number").positive("Enter a whole number greater than zero"),
  title: z.string({ error: "Enter a module title" }).trim().min(1, "Enter a module title"),
  summary: z.string().trim().optional(),
  examQuestionDraw: z.coerce.number().int().min(0).default(2),
});

export const lectureInputSchema = z.object({
  title: z.string({ error: "Enter a lecture title" }).trim().min(1, "Enter a lecture title"),
  mediaKind: z.enum(["SLIDES", "VIDEO"], { error: "Choose slides or video" }),
  videoUrl: z.string().trim().url().nullable().optional(),
  videoAssetId: z.string().nullable().optional(),
  scenarioPrompt: z.string().trim().optional(),
  scenarioGuidance: z.string().trim().optional(),
  draftingPrompt: z.string().trim().optional(),
  draftingWordLimit: z.coerce.number().int().positive().optional(),
});

export const slideInputSchema = z.object({
  title: z.string().trim().optional(),
  body: z.string().trim().optional(),
  imageAssetId: z.string().optional(),
});

export const narrationConfigSchema = z
  .object({
    narrationMode: z.enum(["NONE", "PER_SLIDE", "FULL_LECTURE"], { error: "Choose a narration mode" }),
    narrationAutoAdvance: z.boolean().default(false),
    narrationRequireFull: z.boolean().default(false),
    fullNarrationAssetId: z.string().nullable().optional(),
  })
  .refine((c) => c.narrationMode !== "FULL_LECTURE" || !c.narrationAutoAdvance, {
    message: "narrationAutoAdvance must be false when narrationMode is FULL_LECTURE",
    path: ["narrationAutoAdvance"],
  })
  .refine((c) => c.narrationMode === "FULL_LECTURE" || !c.fullNarrationAssetId, {
    message: "fullNarrationAssetId can only be set when narrationMode is FULL_LECTURE",
    path: ["fullNarrationAssetId"],
  });

export type NarrationConfigInput = z.infer<typeof narrationConfigSchema>;

export const quizOptionInputSchema = z.object({
  text: z.string({ error: "Enter the option text" }).trim().min(1, "Enter the option text"),
  isCorrect: z.boolean().default(false),
});

export const quizQuestionInputSchema = z.object({
  prompt: z.string({ error: "Enter the question" }).trim().min(1, "Enter the question"),
  marks: z.coerce.number().int().positive().default(1),
  explanation: z.string().trim().optional(),
  options: z.array(quizOptionInputSchema).min(2, "At least two options are required"),
});

export const upsertQuizSchema = z.object({
  passMarkPercent: z.coerce.number().int().min(1).max(100).default(60),
  questions: z.array(quizQuestionInputSchema),
});

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline, per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
