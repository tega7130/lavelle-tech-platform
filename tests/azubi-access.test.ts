import { describe, it, expect } from "vitest";
import { hasPermission } from "@/lib/permissions";

/**
 * This repo has no Supabase RLS anywhere (see AZUBI_BUILD_BRIEF.md's
 * disagreement note) — access control for AzubiApplication/AzubiEnquiry is
 * entirely requireStaffPermission(Permission.MANAGE_AZUBI), which is built
 * on the same hasPermission primitive every other admin feature uses.
 * tests/permissions.test.ts already proves "presence is the sole
 * authority" generically; this proves it holds for MANAGE_AZUBI
 * specifically, the same boundary the rest of this suite tests at (the
 * cookie-session layer underneath requireStaffPermission isn't exercised
 * anywhere else in this suite either, since next/headers needs a real
 * request scope that vitest doesn't provide).
 */
describe("MANAGE_AZUBI — presence is the sole authority", () => {
  it("a staff member without the MANAGE_AZUBI grant does not have it, regardless of role", () => {
    expect(hasPermission({ grants: [{ permission: "VIEW_CANDIDATES" as never }] }, "MANAGE_AZUBI" as never)).toBe(false);
  });

  it("a staff member holding the MANAGE_AZUBI grant has it", () => {
    expect(hasPermission({ grants: [{ permission: "MANAGE_AZUBI" as never }] }, "MANAGE_AZUBI" as never)).toBe(true);
  });

  it("holding every other permission does not imply MANAGE_AZUBI", () => {
    const everythingElse = [
      "VIEW_CANDIDATES",
      "MANAGE_STAFF",
      "VIEW_AUDIT_LOG",
      "MANAGE_LAWYER_WEBSITES",
    ] as const;
    expect(hasPermission({ grants: everythingElse.map((permission) => ({ permission: permission as never })) }, "MANAGE_AZUBI" as never)).toBe(
      false
    );
  });
});
