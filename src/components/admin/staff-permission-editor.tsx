"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { applyRolePresetAction, setPermissionAction, deactivateStaffAction } from "@/app/actions/staff";
import { ResendInvitationButton } from "@/components/admin/resend-invitation-button";
import { PERMISSIONS, PERMISSION_CATEGORIES, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { StaffRole, Permission } from "@/lib/permissions";

// Referencing a Prisma-generated enum as a runtime value from a "use
// client" component crashes Turbopack's bundler (see invite-staff-button
// .tsx) — StaffRole/Permission are imported type-only here; ROLE_LABELS
// (a plain object literal this codebase owns) supplies the actual
// runtime list of roles.
const ROLES = Object.keys(ROLE_LABELS) as StaffRole[];

export function StaffPermissionEditor({
  staff,
  isSelf,
}: {
  staff: { id: string; name: string; email: string; role: StaffRole; status: string; permissions: Permission[] };
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = React.useState<StaffRole>(staff.role);
  const [busy, setBusy] = React.useState(false);
  const [deactivating, setDeactivating] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const grants = new Set(staff.permissions);

  const locked = isSelf || staff.status === "DEACTIVATED";

  async function applyPreset() {
    setBusy(true);
    try {
      await applyRolePresetAction(staff.id, role);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(permission: Permission, granted: boolean) {
    setBusy(true);
    try {
      await setPermissionAction(staff.id, permission, granted);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitDeactivate() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await deactivateStaffAction(staff.id, reason);
      setDeactivating(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[720px]">
      <Link href="/admin/staff" className="text-accent text-xs">
        &larr; Back to staff
      </Link>

      <div className="flex items-center justify-between mt-3 mb-[var(--space-4)]">
        <div>
          <h1 className="font-heading text-xl mb-0">{staff.name}</h1>
          <div className="text-neutral-600 text-[12.5px]">{staff.email}</div>
          {staff.status === "INVITED" && (
            <div className="mt-1.5 flex items-center gap-2.5 text-[12px]">
              <span className="text-[#a16207]">Awaiting activation</span>
              <ResendInvitationButton staffId={staff.id} />
            </div>
          )}
        </div>
        {staff.status !== "DEACTIVATED" && (
          <Button variant="danger" className="h-[31px] px-[11px] text-xs" disabled={locked} onClick={() => setDeactivating(true)}>
            Deactivate
          </Button>
        )}
      </div>

      {isSelf && (
        <div className="p-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] text-[12.5px] text-[#8a6013] mb-[var(--space-4)]">
          You cannot change your own role or permissions. Ask another admin to make this change.
        </div>
      )}

      <Card elev="sm" className="mb-[var(--space-4)]">
        <CardKicker>Role</CardKicker>
        <div className="flex items-center gap-2 mt-2">
          <select
            className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={role}
            disabled={locked}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={locked || busy || role === staff.role} onClick={applyPreset}>
            Apply preset
          </Button>
          <span
            className="inline-flex items-center rounded-full text-[11px] font-medium px-[10px] py-[3px] text-white ml-auto"
            style={{ backgroundColor: ROLE_COLORS[staff.role] }}
          >
            {ROLE_LABELS[staff.role]}
          </span>
        </div>
        <p className="text-[11.5px] text-neutral-500 mt-2">Applying a preset replaces the current permission set below.</p>
      </Card>

      <Card elev="sm">
        <CardKicker>Permissions</CardKicker>
        <div className="flex flex-col gap-4 mt-2">
          {PERMISSION_CATEGORIES.map((category) => (
            <div key={category}>
              <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500 mb-1.5">{category}</div>
              <div className="flex flex-col gap-1.5">
                {PERMISSIONS.filter((p) => p.category === category).map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-[13px]">
                    <Checkbox
                      checked={grants.has(p.key)}
                      disabled={locked || busy}
                      onChange={(e) => toggle(p.key, e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{p.key.toLowerCase().replace(/_/g, " ")}</span>
                      <span className="block text-[11.5px] text-neutral-500">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {deactivating && (
        <Dialog open onClose={() => setDeactivating(false)} title="Deactivate this account?">
          <p>The staff member is signed out and can no longer sign in. This does not delete their history — every action they took remains in the audit log.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for deactivation" rows={2} className="mt-3" />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setDeactivating(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !reason.trim()} onClick={submitDeactivate}>
              Deactivate account
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
