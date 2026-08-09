"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Field, Label } from "@/components/ui/field";
import { inviteStaffAction } from "@/app/actions/staff";
import { ROLE_LABELS } from "@/lib/permissions";
import type { StaffRole } from "@/lib/permissions";

// Referencing a Prisma-generated enum as a runtime value (Object.values(),
// or property access like StaffRole.SUPPORT) from a "use client" component
// crashes Turbopack's bundler outright ("chunking context does not support
// external modules (request: node:module)") — reproducible in both
// `next dev` and `next build`. StaffRole is imported type-only here;
// ROLE_LABELS (a plain object literal this codebase owns) supplies the
// actual runtime list of roles, and "SUPPORT" is a plain string literal
// rather than StaffRole.SUPPORT.
const ROLES = (Object.keys(ROLE_LABELS) as StaffRole[]).filter((r) => r !== "SUPER_ADMIN");

export function InviteStaffButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>("SUPPORT" as StaffRole);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      await inviteStaffAction({ name, email, role });
      setOpen(false);
      setName("");
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Invite staff
      </Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title="Invite a staff member">
          <div className="flex flex-col gap-3">
            <Field>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <Label>Role</Label>
              <select
                className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            {error && <div className="text-[12.5px] text-[#b42318]">{error}</div>}
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={submit}>
                Send invite
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
