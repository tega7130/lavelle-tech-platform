import { describe, it, expect, afterAll } from "vitest";
import { testPrisma } from "./db";

describe("next_applicant_number() under concurrency", () => {
  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("issues N distinct, correctly formatted numbers for N concurrent callers", async () => {
    const N = 25;
    const year = new Date().getFullYear();

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        testPrisma.$queryRaw<{ next_applicant_number: string }[]>`SELECT next_applicant_number()`
      )
    );
    const numbers = results.map((r) => r[0]!.next_applicant_number);

    // Never derived from COUNT(*), so no two concurrent callers can race
    // into the same value — this is the property that would break first.
    expect(new Set(numbers).size).toBe(N);

    const pattern = new RegExp(`^LVL-APP-${year}-\\d{5}$`);
    for (const n of numbers) expect(n).toMatch(pattern);
  });

  it("never reuses a number, even across many sequential calls", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const rows = await testPrisma.$queryRaw<
        { next_applicant_number: string }[]
      >`SELECT next_applicant_number()`;
      const n = rows[0]!.next_applicant_number;
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
  });
});
