import { describe, it, expect } from "vitest";
import { offlinePaymentInputSchema } from "@/lib/validation/payment";

const VALID = {
  amountNaira: "450000",
  offlineReceivedOn: "2026-08-06",
  offlineMode: "BANK_TRANSFER",
  offlineReference: "GTB/TRF/20260806/884213",
  receiptAssetId: "asset-1",
  reconciliationNote: "Matched against the 6 August GTBank statement, line 42.",
  verified: "on",
};

function omit(key: keyof typeof VALID): Record<string, string> {
  const copy: Record<string, string> = { ...VALID };
  delete copy[key];
  return copy;
}

describe("offline payment recording — all six required inputs, refused server-side one at a time", () => {
  it("accepts a fully complete recording", () => {
    expect(offlinePaymentInputSchema.safeParse(VALID).success).toBe(true);
  });

  it("refuses a missing amount with a specific message", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("amountNaira"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message === "Enter the amount received")).toBe(true);
  });

  it("refuses a zero or negative amount", () => {
    expect(offlinePaymentInputSchema.safeParse({ ...VALID, amountNaira: "0" }).success).toBe(false);
    expect(offlinePaymentInputSchema.safeParse({ ...VALID, amountNaira: "-100" }).success).toBe(false);
  });

  it("refuses a missing date received", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("offlineReceivedOn"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message === "Enter the date the money arrived")).toBe(true);
  });

  it("refuses an invalid mode of payment", () => {
    expect(offlinePaymentInputSchema.safeParse({ ...VALID, offlineMode: "CRYPTO" }).success).toBe(false);
  });

  it("refuses a missing transaction reference", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("offlineReference"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "A transaction reference is required so the ledger reconciles")).toBe(true);
    }
  });

  it("refuses a missing receipt", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("receiptAssetId"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Attach the transaction receipt before recording")).toBe(true);
    }
  });

  it("refuses a missing reconciliation note", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("reconciliationNote"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "A reconciliation note is required and is written to the audit log")).toBe(true);
    }
  });

  it("refuses an unchecked verification affirmation", () => {
    const result = offlinePaymentInputSchema.safeParse(omit("verified"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Confirm you have verified this against the bank statement")).toBe(true);
    }
  });
});
