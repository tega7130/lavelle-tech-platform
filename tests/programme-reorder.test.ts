import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";

/**
 * reorderModules/reorderLectures write orderIndex for the whole set in a
 * single prisma.$transaction([...]) array — this exercises that exact
 * mechanism directly (bypassing the staff-auth wrapper, which needs a
 * real Next.js request context) to confirm two concurrent full-set
 * reorders can't interleave into a corrupt mixed state: whichever
 * transaction commits second must fully determine the final order, never
 * a blend of both.
 */
async function reorderModules(moduleIds: string[]) {
  await testPrisma.$transaction(
    moduleIds.map((id, index) => testPrisma.module.update({ where: { id }, data: { orderIndex: index } }))
  );
}

describe("concurrent module reordering stays transactional", () => {
  let programmeId: string;
  let staffId: string;
  let categoryId: string;
  let moduleIds: string[];

  beforeAll(async () => {
    const staff = await testPrisma.staff.create({
      data: {
        name: "Test Reorder Staff",
        email: `reorder-test-${crypto.randomUUID()}@example.com`,
        role: "ACADEMIC_ADMIN",
        passwordHash: "not-a-real-hash",
      },
    });
    staffId = staff.id;

    const category = await testPrisma.programmeCategory.create({
      data: { name: `Reorder Test Category ${crypto.randomUUID()}`, slug: `reorder-test-${crypto.randomUUID()}` },
    });
    categoryId = category.id;

    const programme = await testPrisma.programme.create({
      data: {
        code: `RT-${crypto.randomUUID().slice(0, 8)}`,
        title: "Reorder Test Programme",
        categoryId,
        tier: "FOUNDATION",
        summary: "test",
        weeks: 4,
        weeklyHoursLabel: "4 hrs / week",
        credits: 8,
        feeMinor: 1000,
        createdByStaffId: staffId,
      },
    });
    programmeId = programme.id;

    const modules = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        testPrisma.module.create({
          data: { programmeId, weekNumber: i + 1, title: `Module ${i}`, orderIndex: i },
        })
      )
    );
    moduleIds = modules.map((m) => m.id);
  });

  afterAll(async () => {
    await testPrisma.programme.delete({ where: { id: programmeId } }); // cascades modules
    await testPrisma.programmeCategory.delete({ where: { id: categoryId } });
    await testPrisma.staff.delete({ where: { id: staffId } });
    await testPrisma.$disconnect();
  });

  it("a single reorder writes a dense, unique 0..N-1 orderIndex for every module", async () => {
    const reversed = [...moduleIds].reverse();
    await reorderModules(reversed);

    const modules = await testPrisma.module.findMany({ where: { programmeId }, orderBy: { orderIndex: "asc" } });
    expect(modules.map((m) => m.id)).toEqual(reversed);
    expect(modules.map((m) => m.orderIndex)).toEqual([0, 1, 2, 3]);
  });

  it("two concurrent full-set reorders never leave a mixed/corrupt order — either one wins outright, or Postgres's own deadlock detector aborts the loser cleanly", async () => {
    const orderA = [...moduleIds];
    const orderB = [...moduleIds].reverse();

    // Two transactions touching the same 4 rows in opposite sequence is
    // the textbook lock-ordering deadlock — Postgres is expected to abort
    // one of them (40P01) rather than let them interleave. allSettled
    // (not all) is deliberate: a rejection here is a correct outcome to
    // assert on, not a test-infra failure.
    const results = await Promise.allSettled([reorderModules(orderA), reorderModules(orderB)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBeGreaterThanOrEqual(1); // at least one transaction must have committed

    const modules = await testPrisma.module.findMany({ where: { programmeId }, orderBy: { orderIndex: "asc" } });
    const finalIds = modules.map((m) => m.id);

    // The committed result must match ONE ordering exactly — never a
    // partial interleave of both, which would prove the transaction
    // boundary leaked.
    const matchesA = JSON.stringify(finalIds) === JSON.stringify(orderA);
    const matchesB = JSON.stringify(finalIds) === JSON.stringify(orderB);
    expect(matchesA || matchesB).toBe(true);

    // orderIndex stays dense and unique regardless of which one won or
    // whether one was aborted — a partial interleave would show up here
    // as a duplicate or a gap.
    const indexes = modules.map((m) => m.orderIndex).sort((a, b) => a - b);
    expect(indexes).toEqual([0, 1, 2, 3]);
  });

  it("orderIndex has no duplicates even under repeated concurrent reorders, however many of them a deadlock aborts", async () => {
    await Promise.allSettled([
      reorderModules([...moduleIds]),
      reorderModules([...moduleIds].reverse()),
      reorderModules([moduleIds[1]!, moduleIds[0]!, moduleIds[3]!, moduleIds[2]!]),
    ]);

    const modules = await testPrisma.module.findMany({ where: { programmeId } });
    const indexes = modules.map((m) => m.orderIndex);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes.sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});
