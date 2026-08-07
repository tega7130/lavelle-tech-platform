import { describe, it, expect } from "vitest";
import { requireEnrolled, NotEnrolledError, type CurrentCandidate } from "@/lib/candidate-session";
import { isGatedPortalPath, GATED_PORTAL_HREFS } from "@/lib/candidate-nav";

function makeCandidate(isEnrolled: boolean): CurrentCandidate {
  return {
    id: "test",
    applicantNumber: "LVL-APP-2026-00001",
    candidateNumber: isEnrolled ? "LVL/2026/00001" : null,
    firstName: "Test",
    lastName: "Candidate",
    email: "test@example.com",
    emailVerifiedAt: null,
    accountStatus: "ACTIVE",
    isEnrolled,
    profile: null,
    checklist: {
      account: true,
      professional: false,
      photo: false,
      email: false,
      handbook: false,
      doneCount: 1,
      allDone: false,
    },
  };
}

describe("layer 3 — requireEnrolled() (Server Action / route handler boundary)", () => {
  it("throws NotEnrolledError for an applicant", () => {
    expect(() => requireEnrolled(makeCandidate(false))).toThrow(NotEnrolledError);
  });

  it("throws NotEnrolledError for a signed-out request (null candidate)", () => {
    expect(() => requireEnrolled(null)).toThrow(NotEnrolledError);
  });

  it("does not throw for an enrolled candidate", () => {
    expect(() => requireEnrolled(makeCandidate(true))).not.toThrow();
  });
});

describe("layer 1 — isGatedPortalPath() (proxy.ts's route-gating decision)", () => {
  it("matches every route Handoff 00 says an applicant loses", () => {
    for (const href of ["/portal/programme", "/portal/deadlines", "/portal/assessment", "/portal/exams", "/portal/credentials", "/portal/ai"]) {
      expect(isGatedPortalPath(href)).toBe(true);
    }
  });

  it("does not match the four routes an applicant keeps", () => {
    for (const href of ["/portal/dashboard", "/portal/catalogue", "/portal/profile", "/portal/support"]) {
      expect(isGatedPortalPath(href)).toBe(false);
    }
  });

  it("matches sub-paths of a gated route, not just the exact href", () => {
    expect(isGatedPortalPath("/portal/programme/week-1")).toBe(true);
  });

  it("the gated set is exactly what's marked gated in the nav config — no drift", () => {
    expect(GATED_PORTAL_HREFS.sort()).toEqual(
      ["/portal/programme", "/portal/deadlines", "/portal/assessment", "/portal/exams", "/portal/credentials", "/portal/ai"].sort()
    );
  });
});
