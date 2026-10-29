import { describe, it, expect } from "vitest";
import { azubiApplicationSchema, azubiEnquirySchema } from "@/lib/validation/azubi";

const validApplication = {
  fullName: "Ada Eze",
  email: "ada@example.com",
  phoneDialCode: "+234",
  phoneNumber: "08012345678",
  country: "Nigeria",
  state: "Lagos",
  statusKind: "student",
  institution: "University of Lagos",
  workingMode: "hybrid",
  areas: ["corporate_commercial", "litigation_dispute"],
  statement: "I want practical experience.",
  consent: "on",
  companyWebsite: "",
};

const validEnquiry = {
  fullName: "Chidi Okafor",
  email: "chidi@example.com",
  phoneDialCode: "+234",
  phoneNumber: "08012345678",
  organisation: "",
  writingAs: "A prospective fellow",
  message: "I have a question about eligibility.",
  consent: "on",
  companyWebsite: "",
  source: "CONTACT_PAGE",
};

describe("azubiApplicationSchema", () => {
  it("accepts a valid submission, normalises enum slugs and combines the phone", () => {
    const result = azubiApplicationSchema.safeParse(validApplication);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statusKind).toBe("STUDENT");
      expect(result.data.workingMode).toBe("HYBRID");
      expect(result.data.areas).toEqual(["corporate_commercial", "litigation_dispute"]);
      expect(result.data.phone).toBe("+234 08012345678");
      expect(result.data.country).toBe("Nigeria");
    }
  });

  it("accepts a single checked area as a bare string, not just an array", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, areas: "corporate_commercial" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.areas).toEqual(["corporate_commercial"]);
  });

  it("rejects a filled honeypot field", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, companyWebsite: "https://spam.example" });
    expect(result.success).toBe(false);
  });

  it("rejects when consent is not given", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, consent: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects an empty areas selection", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, areas: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a statement over 1,500 characters", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, statement: "x".repeat(1501) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status slug", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, statusKind: "called_to_the_moon" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown country", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, country: "Narnia" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid dial code", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, phoneDialCode: "+999999" });
    expect(result.success).toBe(false);
  });

  it("strips non-digits from the phone number before combining", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, phoneNumber: "080 123 456 78" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+234 08012345678");
  });

  it("requires otherAreaDetail when 'other' is a selected area", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, areas: ["other"], otherAreaDetail: "" });
    expect(result.success).toBe(false);
  });

  it("accepts 'other' with a detail provided", () => {
    const result = azubiApplicationSchema.safeParse({ ...validApplication, areas: ["other"], otherAreaDetail: "Family law" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.otherAreaDetail).toBe("Family law");
  });

  it("does not require otherAreaDetail when 'other' is not selected", () => {
    const result = azubiApplicationSchema.safeParse(validApplication);
    expect(result.success).toBe(true);
  });
});

describe("azubiEnquirySchema", () => {
  it("accepts a valid submission, maps writingAs and combines the phone", () => {
    const result = azubiEnquirySchema.safeParse(validEnquiry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.writingAs).toBe("FELLOW");
      expect(result.data.phone).toBe("+234 08012345678");
    }
  });

  it("maps every writingAs label to its enum value", () => {
    const cases: Array<[string, string]> = [
      ["A prospective fellow", "FELLOW"],
      ["A law firm or legal organisation", "HOST"],
      ["Another organisation", "OTHER_ORG"],
      ["Something else", "OTHER"],
    ];
    for (const [label, expected] of cases) {
      const result = azubiEnquirySchema.safeParse({ ...validEnquiry, writingAs: label });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.writingAs).toBe(expected);
    }
  });

  it("rejects a filled honeypot field", () => {
    const result = azubiEnquirySchema.safeParse({ ...validEnquiry, companyWebsite: "spam" });
    expect(result.success).toBe(false);
  });

  it("rejects when consent is not given", () => {
    const result = azubiEnquirySchema.safeParse({ ...validEnquiry, consent: "false" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing phone number", () => {
    const result = azubiEnquirySchema.safeParse({ ...validEnquiry, phoneNumber: "" });
    expect(result.success).toBe(false);
  });

  it("treats organisation as optional", () => {
    const { organisation, ...rest } = validEnquiry;
    const result = azubiEnquirySchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects a message over 4,000 characters", () => {
    const result = azubiEnquirySchema.safeParse({ ...validEnquiry, message: "x".repeat(4001) });
    expect(result.success).toBe(false);
  });
});
