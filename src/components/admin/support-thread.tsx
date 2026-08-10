"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { respondToRequestAction, resolveRequestAction, reopenRequestAction } from "@/app/actions/support";
import { AssignRequestDialog } from "@/components/admin/assign-request-dialog";
import type { getSupportRequestThread } from "@/lib/support-reads";

type Thread = NonNullable<Awaited<ReturnType<typeof getSupportRequestThread>>>;

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
};

// Plain string-keyed lookups, not the Prisma enum object — see
// assign-request-dialog.tsx's note on why an enum VALUE import breaks a
// "use client" build. request.priority arrives as already-serialized
// data here, so reading it is fine; importing RequestPriority itself
// would not be.
const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", NORMAL: "Normal", URGENT: "Urgent" };
const PRIORITY_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = { LOW: "neutral", NORMAL: "accent", URGENT: "danger" };

export function SupportThread({ request }: { request: Thread }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  async function submitReply() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await respondToRequestAction(request.id, body);
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitResolve() {
    setBusy(true);
    setResolveError(null);
    try {
      await resolveRequestAction(request.id);
      router.refresh();
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Could not resolve this request.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReopen() {
    setBusy(true);
    try {
      await reopenRequestAction(request.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[720px]">
      <Link href="/admin/support" className="text-accent text-xs">
        &larr; Back to support desk
      </Link>

      <div className="flex items-center justify-between mt-3 mb-[var(--space-3)]">
        <div>
          <CardKicker>{request.category}</CardKicker>
          <h1 className="font-heading text-xl">{request.subject}</h1>
          <div className="text-neutral-600 text-[12.5px]">
            {request.candidate ? (
              <>
                <Link href={`/admin/candidates/${request.candidate.id}`} className="text-accent">
                  {request.candidate.firstName} {request.candidate.lastName}
                </Link>{" "}
                &middot; {request.candidate.candidateNumber ?? request.candidate.applicantNumber} &middot; {request.candidate.email}
              </>
            ) : (
              <>
                {request.guestName} &middot; {request.guestEmail} &middot; <span className="uppercase tracking-[0.06em] text-[10px]">Website enquiry</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag variant={PRIORITY_TAG[request.priority]}>{PRIORITY_LABEL[request.priority]}</Tag>
          <Tag variant={STATUS_TAG[request.status] as TagVariant}>{request.status.replace(/_/g, " ")}</Tag>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap px-4 py-3 rounded-md bg-neutral-100 border border-divider mb-[var(--space-4)]">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Assigned to</span>
          <span className="text-[12.5px] font-medium">{request.assignedStaff?.name ?? "Unassigned"}</span>
        </div>
        {request.assignedByStaff && (
          <div className="text-neutral-500 text-[11.5px]">Assigned by {request.assignedByStaff.name}</div>
        )}
        <div className="flex-1" />
        <Button variant="secondary" className="h-8 text-[12px]" onClick={() => setAssignOpen(true)}>
          {request.assignedStaff ? "Reassign" : "Assign"}
        </Button>
      </div>

      {request.assignmentNote && (
        <div className="text-neutral-600 text-[12px] leading-[1.6] mb-[var(--space-4)] -mt-3">
          <span className="text-neutral-500">Note to assignee: </span>
          {request.assignmentNote}
        </div>
      )}

      <div className="flex flex-col gap-2 mb-[var(--space-4)]">
        {request.messages.map((m) => (
          <div key={m.id} className={m.authorStaff ? "self-end max-w-[70%]" : "self-start max-w-[70%]"}>
            <Card elev="sm" className={m.authorStaff ? "bg-accent-100" : ""}>
              <div className="text-[13px]">{m.body}</div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {m.authorStaff?.name ?? `${m.authorCandidate?.firstName ?? "Candidate"} ${m.authorCandidate?.lastName ?? ""}`} ·{" "}
                {new Date(m.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {resolveError && (
        <div className="mb-3 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[12.5px] text-[#912019]">{resolveError}</div>
      )}

      {request.status === "RESOLVED" ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-[#e7f6ed] border border-[#bfe3cd]">
          <div className="text-[12.5px] text-[#116632]">
            Resolved{request.resolvedByStaff ? ` by ${request.resolvedByStaff.name}` : ""}
            {request.resolvedAt ? ` · ${new Date(request.resolvedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}` : ""}
          </div>
          <Button variant="secondary" className="h-8 text-[12px]" disabled={busy} onClick={submitReopen}>
            Reopen
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply to the candidate…" rows={3} className="flex-1" />
          <div className="flex flex-col gap-1.5">
            <Button variant="primary" disabled={busy || !body.trim()} onClick={submitReply}>
              Reply
            </Button>
            <Button variant="secondary" disabled={busy} onClick={submitResolve}>
              Resolve
            </Button>
          </div>
        </div>
      )}

      <AssignRequestDialog requestId={request.id} subject={request.subject} open={assignOpen} onClose={() => setAssignOpen(false)} />
    </div>
  );
}
