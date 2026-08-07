import { z } from "zod";

export const programmeCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers and hyphens only, e.g. ELR-201");

// Base object kept separate from its .refine()s so updateProgrammeSchema
// can derive a .partial() version below — .partial() only exists on a
// plain ZodObject, not on the ZodEffects a chained .refine() produces.
const programmeObjectSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  code: programmeCodeSchema,
  categoryId: z.string().min(1).optional(),
  newCategoryName: z.string().trim().min(1).max(120).optional(),
  tier: z.enum(["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"]),
  summary: z.string().trim().min(1, "Required"),
  weeks: z.coerce.number().int().positive(),
  weeklyHoursLabel: z.string().trim().min(1, "Required"),
  credits: z.coerce.number().int().positive(),
  // Fee arrives from the form as naira (a human types "450000"); the
  // server converts to kobo — feeMinor itself is never entered directly,
  // so a decimal typo can't silently become a 100x-off integer.
  feeNaira: z.coerce.number().positive("Fee must be greater than zero"),
  currency: z.string().trim().min(1).default("NGN"),
  deliveryLabel: z.string().trim().min(1).default("Online + proctored exam"),
  prerequisiteTier: z.enum(["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"]).optional(),
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
    quiz: z.coerce.number().int().min(0).max(100),
    drafting: z.coerce.number().int().min(0).max(100),
    examination: z.coerce.number().int().min(0).max(100),
  })
  .refine((w) => w.quiz + w.drafting + w.examination === 100, {
    message: "Assessment weights must total exactly 100",
  });

export const moduleInputSchema = z.object({
  weekNumber: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "Required"),
  summary: z.string().trim().optional(),
  examQuestionDraw: z.coerce.number().int().min(0).default(2),
});

export const lectureInputSchema = z.object({
  title: z.string().trim().min(1, "Required"),
  mediaKind: z.enum(["SLIDES", "VIDEO"]),
  videoUrl: z.string().trim().url().optional(),
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
    narrationMode: z.enum(["NONE", "PER_SLIDE", "FULL_LECTURE"]),
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
  text: z.string().trim().min(1, "Required"),
  isCorrect: z.boolean().default(false),
});

export const quizQuestionInputSchema = z.object({
  prompt: z.string().trim().min(1, "Required"),
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
