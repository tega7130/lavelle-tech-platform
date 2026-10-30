import { describe, it, expect, afterEach } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { submitAzubiApplicationCore, submitAzubiEnquiryCore } from "@/lib/azubi/forms";
import { azubiApplicationSchema, azubiEnquirySchema, AZUBI_PRIVACY_VERSION } from "@/lib/validation/azubi";

function applicationInput(overrides: Partial<Record<string, unknown>> = {}) {
  const parsed = azubiApplicationSchema.parse({
    fullName: "Test Fellow",
    email: `fellow-${crypto.randomUUID()}@example.com`,
    phone: "08012345678",
    state: "Lagos",
    statusKind: "student",
    institution: "University of Lagos",
    workingMode: "hybrid",
    areas: ["corporate_commercial"],
    statement: "A statement.",
    consent: "on",
    companyWebsite: "",
    ...overrides,
  });
  return parsed;
}

function enquiryInput(overrides: Partial<Record<string, unknown>> = {}) {
  return azubiEnquirySchema.parse({
    fullName: "Test Enquirer",
    email: `enquirer-${crypto.randomUUID()}@example.com`,
    organisation: "",
    writingAs: "A prospective fellow",
    message: "A message.",
    consent: "on",
    companyWebsite: "",
    source: "CONTACT_PAGE",
    ...overrides,
  });
}

const createdApplicationEmails = new Set<string>();
const createdEnquiryEmails = new Set<string>();

afterEach(async () => {
  if (createdApplicationEmails.size) {
    await testPrisma.azubiApplication.deleteMany({ where: { email: { in: [...createdApplicationEmails] } } });
    createdApplicationEmails.clear();
  }
  if (createdEnquiryEmails.size) {
    await testPrisma.azubiEnquiry.deleteMany({ where: { email: { in: [...createdEnquiryEmails] } } });
    createdEnquiryEmails.clear();
  }
});

describe("submitAzubiApplicationCore", () => {
  it("creates an application with consent and privacy version recorded", async () => {
    const input = applicationInput();
    createdApplicationEmails.add(input.email);

    const result = await submitAzubiApplicationCore(input, `203.0.113.${Math.floor(Math.random() * 254) + 1}`);
    expect(result.ok).toBe(true);

    const row = await testPrisma.azubiApplication.findFirst({ where: { email: input.email } });
    expect(row).not.toBeNull();
    expect(row?.pipelineStatus).toBe("NEW");
    expect(row?.privacyVersion).toBe(AZUBI_PRIVACY_VERSION);
    expect(row?.consentAt).toBeInstanceOf(Date);
    expect(row?.areas).toEqual(["corporate_commercial"]);
  });

  it("rejects after the rate limit is exhausted for the same email", async () => {
    const email = `rate-limit-app-${crypto.randomUUID()}@example.com`;
    const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
    createdApplicationEmails.add(email);

    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = await submitAzubiApplicationCore(applicationInput({ email }), ip);
    }
    expect(lastResult?.ok).toBe(false);
    if (lastResult && !lastResult.ok) expect(lastResult.error).toMatch(/too many/i);
  });
});

describe("submitAzubiEnquiryCore", () => {
  it("creates an enquiry with organisation null when omitted", async () => {
    const input = enquiryInput();
    createdEnquiryEmails.add(input.email);

    const result = await submitAzubiEnquiryCore(input, `203.0.113.${Math.floor(Math.random() * 254) + 1}`);
    expect(result.ok).toBe(true);

    const row = await testPrisma.azubiEnquiry.findFirst({ where: { email: input.email } });
    expect(row).not.toBeNull();
    expect(row?.organisation).toBeNull();
    expect(row?.status).toBe("NEW");
    expect(row?.source).toBe("CONTACT_PAGE");
  });

  it("records the source distinguishing the Home form from the Contact page", async () => {
    const input = enquiryInput({ source: "HOME_FORM" });
    createdEnquiryEmails.add(input.email);

    await submitAzubiEnquiryCore(input, `203.0.113.${Math.floor(Math.random() * 254) + 1}`);
    const row = await testPrisma.azubiEnquiry.findFirst({ where: { email: input.email } });
    expect(row?.source).toBe("HOME_FORM");
  });

  it("rejects after the rate limit is exhausted for the same email", async () => {
    const email = `rate-limit-enq-${crypto.randomUUID()}@example.com`;
    const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
    createdEnquiryEmails.add(email);

    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = await submitAzubiEnquiryCore(enquiryInput({ email }), ip);
    }
    expect(lastResult?.ok).toBe(false);
  });
});
