"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { respondToRequestAction, resolveRequestAction } from "@/app/actions/support";
import type { getSupportRequestThread } from "@/lib/support-reads";

type Thread = NonNullable<Awaited<ReturnType<typeof getSupportRequestThread>>>;

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
};

export function SupportThread({ request }: { request: Thread }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

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
    try {
      await resolveRequestAction(request.id);
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

      <div className="flex items-center justify-between mt-3 mb-[var(--space-4)]">
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
        <Tag variant={STATUS_TAG[request.status] as TagVariant}>{request.status.replace(/_/g, " ")}</Tag>
      </div>

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

      {request.status !== "RESOLVED" && (
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
    </div>
  );
}
