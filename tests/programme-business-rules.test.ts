import { describe, it, expect } from "vitest";
import { assessmentWeightsSchema, narrationConfigSchema } from "@/lib/validation/programme";
import { computePublishFailures, validateOneCorrectOptionPerQuestion } from "@/lib/programme-publish";

describe("assessment weights must total exactly 100 (rule 6)", () => {
  it("accepts 20/40/40", () => {
    expect(assessmentWeightsSchema.safeParse({ quiz: 20, drafting: 40, examination: 40 }).success).toBe(true);
  });

  it("rejects a total under 100 with a specific message", () => {
    const result = assessmentWeightsSchema.safeParse({ quiz: 20, drafting: 40, examination: 30 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]!.message).toBe("Assessment weights must total exactly 100");
  });

  it("rejects a total over 100", () => {
    expect(assessmentWeightsSchema.safeParse({ quiz: 30, drafting: 40, examination: 40 }).success).toBe(false);
  });

  it("rejects any negative weight even if the total happens to be 100", () => {
    // 60 + 60 + (-20) = 100 — the per-field min(0) must still catch this.
    expect(assessmentWeightsSchema.safeParse({ quiz: 60, drafting: 60, examination: -20 }).success).toBe(false);
  });
});

describe("programme ACTIVE publish checks (rule 2) — the specific failures, not a generic refusal", () => {
  it("refuses an empty programme with all three reasons", () => {
    const failures = computePublishFailures({ modules: [], assessmentWeightings: [], feeMinor: 0 });
    expect(failures).toHaveLength(3);
    expect(failures.some((f) => f.includes("at least one module"))).toBe(true);
    expect(failures.some((f) => f.includes("assessment type"))).toBe(true);
    expect(failures.some((f) => f.includes("fee"))).toBe(true);
  });

  it("names the specific module missing a lecture", () => {
    const failures = computePublishFailures({
      modules: [
        { title: "Week 1", lectures: [{}] },
        { title: "Week 2 — empty", lectures: [] },
      ],
      assessmentWeightings: [
        { weightPercent: 20 },
        { weightPercent: 40 },
        { weightPercent: 40 },
      ],
      feeMinor: 45_000_000,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("Week 2 — empty");
  });

  it("passes a fully complete programme", () => {
    const failures = computePublishFailures({
      modules: [{ title: "Week 1", lectures: [{}] }],
      assessmentWeightings: [{ weightPercent: 20 }, { weightPercent: 40 }, { weightPercent: 40 }],
      feeMinor: 45_000_000,
    });
    expect(failures).toEqual([]);
  });

  it("refuses a fee of zero even when everything else is complete", () => {
    const failures = computePublishFailures({
      modules: [{ title: "Week 1", lectures: [{}] }],
      assessmentWeightings: [{ weightPercent: 20 }, { weightPercent: 40 }, { weightPercent: 40 }],
      feeMinor: 0,
    });
    expect(failures).toEqual(["Set a fee greater than zero."]);
  });

  // Rule 2 was relaxed from "at least 3 assessment types" to "at least 1" —
  // a standalone exam (Exam 100%, no quiz/drafting) or a course without a
  // certifying exam (Quiz + Drafting only) must both be publishable.
  it("passes a single assessment type totalling 100%", () => {
    const failures = computePublishFailures({
      modules: [{ title: "Week 1", lectures: [{}] }],
      assessmentWeightings: [{ weightPercent: 100 }],
      feeMinor: 45_000_000,
    });
    expect(failures).toEqual([]);
  });

  it("passes two assessment types totalling 100%", () => {
    const failures = computePublishFailures({
      modules: [{ title: "Week 1", lectures: [{}] }],
      assessmentWeightings: [{ weightPercent: 40 }, { weightPercent: 60 }],
      feeMinor: 45_000_000,
    });
    expect(failures).toEqual([]);
  });

  it("refuses one assessment type that doesn't total 100%", () => {
    const failures = computePublishFailures({
      modules: [{ title: "Week 1", lectures: [{}] }],
      assessmentWeightings: [{ weightPercent: 50 }],
      feeMinor: 45_000_000,
    });
    expect(failures).toEqual(["Adjust weights to total exactly 100% (currently 50%)."]);
  });
});

describe("narration mode combinations (rule 5)", () => {
  it("accepts NONE with everything else at its default", () => {
    expect(
      narrationConfigSchema.safeParse({ narrationMode: "NONE", narrationAutoAdvance: false, narrationRequireFull: false }).success
    ).toBe(true);
  });

  it("accepts PER_SLIDE with narrationAutoAdvance true", () => {
    expect(
      narrationConfigSchema.safeParse({ narrationMode: "PER_SLIDE", narrationAutoAdvance: true, narrationRequireFull: false }).success
    ).toBe(true);
  });

  it("rejects FULL_LECTURE with narrationAutoAdvance true — it must be stored false, not just ignored", () => {
    const result = narrationConfigSchema.safeParse({
      narrationMode: "FULL_LECTURE",
      narrationAutoAdvance: true,
      narrationRequireFull: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts FULL_LECTURE with narrationAutoAdvance false and a fullNarrationAssetId", () => {
    expect(
      narrationConfigSchema.safeParse({
        narrationMode: "FULL_LECTURE",
        narrationAutoAdvance: false,
        narrationRequireFull: false,
        fullNarrationAssetId: "some-media-asset-id",
      }).success
    ).toBe(true);
  });

  it("rejects a fullNarrationAssetId set while narrationMode isn't FULL_LECTURE", () => {
    const result = narrationConfigSchema.safeParse({
      narrationMode: "PER_SLIDE",
      narrationAutoAdvance: false,
      narrationRequireFull: false,
      fullNarrationAssetId: "some-media-asset-id",
    });
    expect(result.success).toBe(false);
  });
});

describe("exactly one correct option per quiz question (rule 8)", () => {
  it("passes when every question has exactly one correct option", () => {
    const result = validateOneCorrectOptionPerQuestion([
      { prompt: "Q1", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] },
      { prompt: "Q2", options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: true }, { text: "c", isCorrect: false }] },
    ]);
    expect(result).toBeNull();
  });

  it("flags a question with zero correct options", () => {
    const result = validateOneCorrectOptionPerQuestion([
      { prompt: "Which is right?", options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: false }] },
    ]);
    expect(result).toContain("Which is right?");
    expect(result).toContain("found 0");
  });

  it("flags a question with two correct options", () => {
    const result = validateOneCorrectOptionPerQuestion([
      { prompt: "Q1", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] },
    ]);
    expect(result).toContain("found 2");
  });

  it("identifies which question (by position) is the violation among several", () => {
    const result = validateOneCorrectOptionPerQuestion([
      { prompt: "Fine", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] },
      { prompt: "Broken", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }] },
    ]);
    expect(result).toContain("Question 2");
    expect(result).toContain("Broken");
  });
});
