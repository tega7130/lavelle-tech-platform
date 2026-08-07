import { describe, it, expect } from "vitest";
import { registerSchema, signInSchema, updateProfileSchema, fieldErrors } from "@/lib/validation/candidate";

const VALID_REGISTER = {
  firstName: "Adaeze",
  lastName: "Okonkwo",
  email: "a.okonkwo@chambers.ng",
  phoneCountryCode: "+234",
  phone: "8035528841",
  password: "Chambers2026",
  confirmPassword: "Chambers2026",
  terms: "on",
  marketingOptIn: "on",
};

describe("registerSchema — per-field messages match the README's validation table", () => {
  it("accepts a fully valid submission", () => {
    const result = registerSchema.safeParse(VALID_REGISTER);
    expect(result.success).toBe(true);
  });

  it("requires first and last name", () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, firstName: "", lastName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.firstName).toBe("Required");
      expect(errors.lastName).toBe("Required");
    }
  });

  it("rejects a malformed email with the exact prescribed message", () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).email).toBe("Enter a valid email address, e.g. you@firm.com");
    }
  });

  it("rejects a phone number with fewer than 7 digits", () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, phone: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).phone).toBe("Enter a valid phone number");
    }
  });

  it("allows an absent phone number (optional)", () => {
    const { phone, ...rest } = VALID_REGISTER;
    void phone;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("requires at least 8 characters for password", () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, password: "short1", confirmPassword: "short1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).password).toBe("Use at least 8 characters");
    }
  });

  it("flags a confirm-password mismatch on the confirmPassword field", () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, confirmPassword: "SomethingElse123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).confirmPassword).toBe("Passwords do not match");
    }
  });

  it("requires terms acceptance", () => {
    const { terms, ...rest } = VALID_REGISTER;
    void terms;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).terms).toBe("You must accept the Terms of Use to continue");
    }
  });

  it("does not require marketingOptIn (optional)", () => {
    const { marketingOptIn, ...rest } = VALID_REGISTER;
    void marketingOptIn;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.marketingOptIn).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts a valid email/password pair", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects a malformed email with the exact prescribed message", () => {
    const result = signInSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).email).toBe("Enter a valid email address, e.g. you@firm.com");
    }
  });
});

describe("updateProfileSchema — regression: checkbox fields arrive as strings, not booleans", () => {
  // FormData.set("complete", "true") — the profile modal's actual call
  // shape — used to fail a bare z.boolean() check and silently drop the
  // whole save (caught via direct DB inspection during manual
  // verification: the UI showed "Profile updated" while the row stayed
  // empty). This pins the fix.
  it("accepts the string 'true' for complete and handbookAcknowledged, and coerces to boolean", () => {
    const result = updateProfileSchema.safeParse({
      professionalStatus: "PRACTISING_LAWYER",
      yearOfCall: "2016",
      scnNumber: "SCN123456",
      experienceBand: "Y6_10",
      placeOfPractice: "Lagos State, Nigeria",
      complete: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complete).toBe(true);
      expect(result.data.yearOfCall).toBe(2016);
    }
  });

  it("accepts a native checkbox's 'on' for handbookAcknowledged", () => {
    const result = updateProfileSchema.safeParse({ handbookAcknowledged: "on" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.handbookAcknowledged).toBe(true);
  });

  it("every field is optional — an empty submission (Skip) is valid", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });
});
