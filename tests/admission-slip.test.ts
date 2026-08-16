import { describe, it, expect } from "vitest";
import {
  getSignedAdmissionSlipPdfUrl,
  verifyAdmissionSlipPdfLink,
  isAdmissionSlipReleased,
  admissionSlipReleasedAt,
  seatReferenceFor,
} from "@/lib/admission-slip-pdf";

describe("admission slip — signed link", () => {
  it("round-trips a valid link and rejects tampering or expiry", () => {
    const registrationId = "11111111-2222-3333-4444-555555555555";
    const url = getSignedAdmissionSlipPdfUrl(registrationId);
    const params = new URLSearchParams(url.split("?")[1]);
    const exp = params.get("exp");
    const sig = params.get("sig");

    expect(verifyAdmissionSlipPdfLink(registrationId, exp, sig)).toBe(true);
    expect(verifyAdmissionSlipPdfLink(registrationId, exp, "0".repeat(64))).toBe(false); // tampered signature
    expect(verifyAdmissionSlipPdfLink(registrationId, String(Date.now() - 1000), sig)).toBe(false); // expired
    expect(verifyAdmissionSlipPdfLink("a-different-registration-id", exp, sig)).toBe(false); // signature is scoped to the id
  });
});

describe("admission slip — release gate (rule: released two weeks ahead of the window)", () => {
  it("computes the release date as exactly 14 days before the window opens", () => {
    const opensAt = new Date("2026-09-14T09:00:00Z");
    const releasedAt = admissionSlipReleasedAt(opensAt);
    expect(releasedAt.toISOString()).toBe("2026-08-31T09:00:00.000Z");
  });

  it("is not released a day early and is released exactly on the boundary", () => {
    const opensAt = new Date("2026-09-14T09:00:00Z");
    const oneDayEarly = new Date("2026-08-30T09:00:00Z");
    const onTheBoundary = new Date("2026-08-31T09:00:00Z");
    expect(isAdmissionSlipReleased(opensAt, oneDayEarly)).toBe(false);
    expect(isAdmissionSlipReleased(opensAt, onTheBoundary)).toBe(true);
  });
});

describe("admission slip — seat reference", () => {
  it("is stable for the same registration id and differs across registrations", () => {
    const a = seatReferenceFor("11111111-2222-3333-4444-555555555555");
    const b = seatReferenceFor("11111111-2222-3333-4444-555555555555");
    const c = seatReferenceFor("99999999-8888-7777-6666-555555555555");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^LVL-SEAT-[0-9A-F]{8}$/);
  });
});
