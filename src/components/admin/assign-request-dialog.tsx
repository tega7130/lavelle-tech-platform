"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { assignRequestAction, listAssignableStaffAction } from "@/app/actions/support";
import type { RequestPriority } from "@/generated/prisma/client";

// RequestPriority is imported type-only — referencing a Prisma enum as a
// runtime value from a "use client" component crashes Turbopack's
// bundler (see invite-staff-button.tsx's note). Plain string literals
// cast to the type instead.
const PRIORITIES: { value: RequestPriority; label: string; note: string }[] = [
  { value: "LOW" as RequestPriority, label: "Low", note: "Answer within five working days." },
  { value: "NORMAL" as RequestPriority, label: "Normal", note: "Answer within one working day. The default for most requests." },
  { value: "URGENT" as RequestPriority, label: "Urgent", note: "Answer within four hours. Use for payment failures, exam-day problems and access loss." },
];

type Assignee = Awaited<ReturnType<typeof listAssignableStaffAction>>[number];

export function AssignRequestDialog({
  requestId,
  subject,
  open,
  onClose,
}: {
  requestId: string;
  subject: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [assignees, setAssignees] = React.useState<Assignee[] | null>(null);
  const [staffId, setStaffId] = React.useState<string | null>(null);
  const [priority, setPriority] = React.useState<RequestPriority>("NORMAL" as RequestPriority);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    listAssignableStaffAction().then((list) => {
      setAssignees(list);
      setStaffId((current) => current ?? list[0]?.id ?? null);
    });
  }, [open]);

  async function confirm() {
    if (!staffId) return;
    setBusy(true);
    setError(null);
    try {
      await assignRequestAction(requestId, staffId, priority, note.trim() || undefined);
      onClose();
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign this request.");
    } finally {
      setBusy(false);
    }
  }

  const activePriority = PRIORITIES.find((p) => p.value === priority)!;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assign this request"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !staffId} onClick={confirm}>
            Assign request
          </Button>
        </>
      }
    >
      <div className="text-neutral-500 text-[12.5px] -mt-1 mb-3">{subject}</div>

      {error && <div className="mb-3 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3 py-2 text-[12px] text-[#912019]">{error}</div>}

      <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Assign to</div>
      <div className="flex flex-col gap-1.5 mt-2">
        {assignees === null && <div className="text-neutral-500 text-[12.5px] py-2">Loading staff…</div>}
        {assignees?.length === 0 && <div className="text-neutral-500 text-[12.5px] py-2">No staff hold the respond_support permission yet.</div>}
        {assignees?.map((a) => (
          <label
            key={a.id}
            className={`flex items-center gap-[11px] px-3 py-2 rounded-md cursor-pointer border-[1.5px] ${
              staffId === a.id ? "border-accent-300 bg-accent-100" : "border-divider hover:bg-neutral-100"
            }`}
          >
            <input type="radio" name="assignee" checked={staffId === a.id} onChange={() => setStaffId(a.id)} className="w-[15px] h-[15px] accent-accent" />
            <span className="flex-1 min-w-0">
              <div className="text-[13px] font-medium">{a.name}</div>
              <div className="text-neutral-500 text-[11px]">
                {a.jobTitle ?? "Staff"}
                {a.department ? ` · ${a.department}` : ""}
              </div>
            </span>
            <span className="text-neutral-500 text-[11px] flex-none">
              {a.openCount} open
            </span>
          </label>
        ))}
      </div>

      <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase mt-4">Priority</div>
      <div className="flex gap-[7px] mt-2">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPriority(p.value)}
            className={`flex-1 h-9 rounded-md text-[12.5px] font-medium border-[1.5px] ${
              priority === p.value ? "border-accent-300 bg-accent-100 text-accent-700" : "border-divider text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="text-neutral-500 text-[11.5px] leading-[1.5] mt-2">{activePriority.note}</div>

      <div className="mt-4">
        <label className="block text-neutral-700 text-xs font-medium mb-1.5">Note to the assignee (optional)</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Candidate has already been charged twice, check the ledger first."
        />
      </div>
    </Dialog>
  );
}
