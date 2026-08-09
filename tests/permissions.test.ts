import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { hasPermission } from "@/lib/permissions";
import {
  guardPermission,
  applyRolePreset,
  setPermission,
  deactivateStaff,
  PermissionDeniedError,
  SelfPermissionEditError,
  LastSuperAdminError,
} from "@/lib/rbac";

async function makeStaff(role: "SUPER_ADMIN" | "ACADEMIC_ADMIN" | "FACULTY" | "SUPPORT", status: "ACTIVE" | "INVITED" = "ACTIVE") {
  return testPrisma.staff.create({
    data: { name: "Test Staff", email: `perm-test-${crypto.randomUUID()}@example.com`, role, status, passwordHash: "not-a-real-hash" },
  });
}

async function grant(staffId: string, permission: string, grantedByStaffId: string) {
  await testPrisma.staffPermission.create({ data: { staffId, permission: permission as never, grantedByStaffId } });
}

// Earlier local runs of this suite (before cleanupStaff correctly avoided
// deleting audit_event rows) left `perm-test-*` staff behind uncleaned,
// including extra ACTIVE SUPER_ADMIN rows that would corrupt the
// last-super-admin assertions below. Sweep them first, every run.
beforeAll(async () => {
  const stray = await testPrisma.staff.findMany({ where: { email: { startsWith: "perm-test-" } }, select: { id: true } });
  if (stray.length > 0) await cleanupStaff(...stray.map((s) => s.id));
});

async function cleanupStaff(...ids: string[]) {
  // audit_event rows are never deleted, by anyone, including this cleanup —
  // that is exactly rule 5. actorStaffId is SET NULL on delete, so leftover
  // rows from these tests just lose their actor link, same as production.
  await testPrisma.staffPermission.deleteMany({ where: { OR: [{ staffId: { in: ids } }, { grantedByStaffId: { in: ids } }] } });
  // grantedByStaffId is RESTRICT — clear grants before deleting the granting staff too.
  for (const id of ids) {
    await testPrisma.staff.updateMany({ where: { invitedByStaffId: id }, data: { invitedByStaffId: null } });
  }
  for (const id of ids) {
    await testPrisma.staff.delete({ where: { id } }).catch(() => {});
  }
}

describe("hasPermission — presence is the sole authority (rule 1)", () => {
  it("a SUPER_ADMIN-role staff member without a specific grant row does NOT have that permission", () => {
    expect(hasPermission({ grants: [{ permission: "VIEW_AUDIT_LOG" as never }] }, "MANAGE_STAFF" as never)).toBe(false);
  });

  it("any staff member holding the row has the permission, regardless of role", () => {
    expect(hasPermission({ grants: [{ permission: "MANAGE_STAFF" as never }] }, "MANAGE_STAFF" as never)).toBe(true);
  });
});

describe("guardPermission — the check every mutating action goes through", () => {
  const created: string[] = [];
  afterEach(async () => {
    await cleanupStaff(...created);
    created.length = 0;
  });

  it("throws PermissionDeniedError when the staff member lacks the row", async () => {
    const staff = await makeStaff("FACULTY");
    created.push(staff.id);
    await expect(guardPermission(staff.id, "MANAGE_STAFF" as never)).rejects.toThrow(PermissionDeniedError);
  });

  it("succeeds once the row exists", async () => {
    const staff = await makeStaff("FACULTY");
    created.push(staff.id);
    await grant(staff.id, "MARK_SUBMISSIONS", staff.id);
    await expect(guardPermission(staff.id, "MARK_SUBMISSIONS" as never)).resolves.toBeDefined();
  });
});

describe("self-permission editing is refused", () => {
  const created: string[] = [];
  afterEach(async () => {
    await cleanupStaff(...created);
    created.length = 0;
  });

  it("applyRolePreset refuses when staffId === actingStaffId", async () => {
    const staff = await makeStaff("SUPER_ADMIN");
    created.push(staff.id);
    await expect(applyRolePreset({ staffId: staff.id, role: "ACADEMIC_ADMIN" as never, actingStaffId: staff.id })).rejects.toThrow(
      SelfPermissionEditError
    );
  });

  it("setPermission refuses when staffId === actingStaffId", async () => {
    const staff = await makeStaff("FACULTY");
    created.push(staff.id);
    await expect(
      setPermission({ staffId: staff.id, permission: "MARK_SUBMISSIONS" as never, granted: true, actingStaffId: staff.id })
    ).rejects.toThrow(SelfPermissionEditError);
  });

  it("a non-super-admin cannot promote anyone to SUPER_ADMIN", async () => {
    const acting = await makeStaff("ACADEMIC_ADMIN");
    const target = await makeStaff("FACULTY");
    created.push(acting.id, target.id);
    await expect(applyRolePreset({ staffId: target.id, role: "SUPER_ADMIN" as never, actingStaffId: acting.id })).rejects.toThrow(
      PermissionDeniedError
    );
  });
});

describe("the last-active-super-admin guard, including under concurrency", () => {
  const created: string[] = [];
  // This suite needs to control the WHOLE table's active-super-admin
  // count to exercise "the last one" at all — the seed always keeps one
  // real super admin (a.obi@lavelle.ng) active, and without accounting
  // for it every "solo" scenario here would actually have a second,
  // real super admin in the background, silently defeating the guard.
  // Suspended (not deleted) here and restored in afterAll.
  let temporarilySuspended: string[] = [];

  beforeAll(async () => {
    const others = await testPrisma.staff.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } });
    temporarilySuspended = others.map((s) => s.id);
    if (temporarilySuspended.length > 0) {
      await testPrisma.staff.updateMany({ where: { id: { in: temporarilySuspended } }, data: { status: "SUSPENDED" } });
    }
  });

  afterAll(async () => {
    if (temporarilySuspended.length > 0) {
      await testPrisma.staff.updateMany({ where: { id: { in: temporarilySuspended } }, data: { status: "ACTIVE" } });
    }
  });

  afterEach(async () => {
    await cleanupStaff(...created);
    created.length = 0;
  });

  it("blocks deactivating the sole active super admin", async () => {
    const solo = await makeStaff("SUPER_ADMIN");
    const acting = await makeStaff("ACADEMIC_ADMIN");
    created.push(solo.id, acting.id);
    await expect(deactivateStaff({ staffId: solo.id, reason: "test", actingStaffId: acting.id })).rejects.toThrow(LastSuperAdminError);
  });

  it("allows deactivating one of two active super admins", async () => {
    const a = await makeStaff("SUPER_ADMIN");
    const b = await makeStaff("SUPER_ADMIN");
    created.push(a.id, b.id);
    await deactivateStaff({ staffId: a.id, reason: "test", actingStaffId: b.id });
    const refreshed = await testPrisma.staff.findUniqueOrThrow({ where: { id: a.id } });
    expect(refreshed.status).toBe("DEACTIVATED");
  });

  it(
    "under two CONCURRENT deactivation attempts against the two active super admins, at least one is refused — the pair never both succeed",
    async () => {
      const a = await makeStaff("SUPER_ADMIN");
      const b = await makeStaff("SUPER_ADMIN");
      created.push(a.id, b.id);

      const results = await Promise.allSettled([
        deactivateStaff({ staffId: a.id, reason: "concurrent test", actingStaffId: b.id }),
        deactivateStaff({ staffId: b.id, reason: "concurrent test", actingStaffId: a.id }),
      ]);

      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected.length).toBeGreaterThanOrEqual(1);

      const [refreshedA, refreshedB] = await Promise.all([
        testPrisma.staff.findUniqueOrThrow({ where: { id: a.id } }),
        testPrisma.staff.findUniqueOrThrow({ where: { id: b.id } }),
      ]);
      const stillActiveSuperAdmins = [refreshedA, refreshedB].filter((s) => s.status === "ACTIVE" && s.role === "SUPER_ADMIN");
      expect(stillActiveSuperAdmins.length).toBeGreaterThanOrEqual(1);
    },
    15_000
  );
});

describe("the audit table refuses UPDATE and DELETE for the application role (rule 5)", () => {
  it("INSERT and SELECT succeed", async () => {
    const staff = await makeStaff("SUPER_ADMIN");
    const event = await testPrisma.auditEvent.create({
      data: { actorStaffId: staff.id, subjectType: "staff", subjectId: staff.id, action: "test.probe", description: "probe" },
    });
    expect(event.id).toBeDefined();
    await cleanupStaff(staff.id);
  });

  it("a raw UPDATE against audit_event is rejected by Postgres, not merely by application code", async () => {
    await expect(testPrisma.$executeRawUnsafe(`UPDATE "audit_event" SET description = 'tampered' WHERE true`)).rejects.toThrow(
      /permission denied/i
    );
  });

  it("a raw DELETE against audit_event is rejected by Postgres, not merely by application code", async () => {
    await expect(testPrisma.$executeRawUnsafe(`DELETE FROM "audit_event" WHERE true`)).rejects.toThrow(/permission denied/i);
  });
});
