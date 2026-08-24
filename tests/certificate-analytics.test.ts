import { describe, it, expect } from "vitest";
import { computeCertificateStats, computeIssuanceTimeline } from "@/lib/certificate-analytics";

type Row = Parameters<typeof computeCertificateStats>[0][number];

function cert(overrides: Partial<Row>): Row {
  return {
    id: overrides.id ?? "id",
    certificateNumber: overrides.certificateNumber ?? "LVL-CERT-2026-00001",
    holderName: overrides.holderName ?? "Test Candidate",
    candidateNumber: overrides.candidateNumber ?? "LVL/2026/00001",
    programmeTitle: overrides.programmeTitle ?? "Test Programme",
    tier: overrides.tier ?? "SPECIALIST",
    band: overrides.band ?? "MERIT",
    pathway: overrides.pathway ?? "PATHWAY",
    status: overrides.status ?? "ACTIVE",
    issuedAt: overrides.issuedAt ?? new Date("2026-02-14T00:00:00Z"),
    verificationCount: overrides.verificationCount ?? 0,
    revokedReason: overrides.revokedReason ?? null,
    revokedAt: overrides.revokedAt ?? null,
    supersededByNumber: overrides.supersededByNumber ?? null,
    replacesNumber: overrides.replacesNumber ?? null,
  } as Row;
}

describe("computeCertificateStats", () => {
  it("counts by status, sums verifications, and only bands/pathways ACTIVE rows", () => {
    const rows = [
      cert({ status: "ACTIVE", band: "DISTINCTION", pathway: "PATHWAY", verificationCount: 3 }),
      cert({ status: "ACTIVE", band: "MERIT", pathway: "EXAMINATION_ONLY", verificationCount: 1 }),
      cert({ status: "REVOKED", band: "PASS", pathway: "PATHWAY", verificationCount: 2 }),
      cert({ status: "SUPERSEDED", band: "REFER", pathway: "PATHWAY", verificationCount: 0 }),
    ];

    const stats = computeCertificateStats(rows);

    expect(stats.totalIssued).toBe(4);
    expect(stats.active).toBe(2);
    expect(stats.revoked).toBe(1);
    expect(stats.superseded).toBe(1);
    expect(stats.totalVerifications).toBe(6); // 3+1+2+0, every row counts regardless of status

    // Only the two ACTIVE rows contribute to band/pathway breakdowns —
    // a revoked or superseded certificate shouldn't inflate "how well
    // candidates are doing" figures.
    expect(stats.bandCounts).toEqual({ DISTINCTION: 1, MERIT: 1, PASS: 0, REFER: 0 });
    expect(stats.pathwayCounts).toEqual({ PATHWAY: 1, EXAMINATION_ONLY: 1 });
  });

  it("returns all-zero stats for an empty register", () => {
    const stats = computeCertificateStats([]);
    expect(stats).toEqual({
      totalIssued: 0,
      active: 0,
      revoked: 0,
      superseded: 0,
      totalVerifications: 0,
      bandCounts: { DISTINCTION: 0, MERIT: 0, PASS: 0, REFER: 0 },
      pathwayCounts: { PATHWAY: 0, EXAMINATION_ONLY: 0 },
    });
  });
});

describe("computeIssuanceTimeline", () => {
  it("groups by calendar month, oldest first, counting every row regardless of later status", () => {
    const rows = [
      cert({ issuedAt: new Date("2026-02-05T00:00:00Z"), status: "ACTIVE" }),
      cert({ issuedAt: new Date("2026-02-20T00:00:00Z"), status: "REVOKED" }), // still counted — issuance happened
      cert({ issuedAt: new Date("2026-01-10T00:00:00Z"), status: "ACTIVE" }),
      cert({ issuedAt: new Date("2026-03-01T00:00:00Z"), status: "SUPERSEDED" }),
    ];

    const timeline = computeIssuanceTimeline(rows);

    expect(timeline.map((m) => m.monthKey)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(timeline.find((m) => m.monthKey === "2026-02")!.count).toBe(2);
    expect(timeline.find((m) => m.monthKey === "2026-01")!.label).toBe("January 2026");
  });

  it("returns an empty array for no certificates", () => {
    expect(computeIssuanceTimeline([])).toEqual([]);
  });
});
