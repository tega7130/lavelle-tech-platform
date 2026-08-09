"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { addCandidateNoteAction, respondToRequestAction, resolveRequestAction } from "@/app/actions/support";
import type { getCandidateNotesAndRequests } from "@/lib/candidate-admin-reads";

type NotesAndRequests = Awaited<ReturnType<typeof getCandidateNotesAndRequests>>;

const REQUEST_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
};

export function CandidateNotesRequestsTab({ candidateId, notes, requests }: { candidateId: string } & NotesAndRequests) {
  const router = useRouter();
  const [noteBody, setNoteBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [replyBody, setReplyBody] = React.useState<Record<string, string>>({});

  async function submitNote() {
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await addCandidateNoteAction(candidateId, noteBody);
      setNoteBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(requestId: string) {
    const body = replyBody[requestId];
    if (!body?.trim()) return;
    setBusy(true);
    try {
      await respondToRequestAction(requestId, body);
      setReplyBody({ ...replyBody, [requestId]: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitResolve(requestId: string) {
    setBusy(true);
    try {
      await resolveRequestAction(requestId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h3 className="mb-[var(--space-3)]">Internal notes</h3>
        <div className="flex gap-2 mb-[var(--space-3)]">
          <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add an internal note — never visible to the candidate" rows={2} className="flex-1" />
          <Button variant="secondary" disabled={busy || !noteBody.trim()} onClick={submitNote}>
            Add note
          </Button>
        </div>
        {notes.length === 0 ? (
          <div className="text-neutral-500 text-[12.5px]">No notes yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <Card key={n.id} elev="sm">
                <div className="text-[13px]">{n.body}</div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {n.authorStaff.name} · {new Date(n.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-[var(--space-3)]">Support requests</h3>
        {requests.length === 0 ? (
          <div className="text-center py-10 border border-divider rounded-md text-neutral-500 text-sm">
            No support requests from this candidate.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <Card key={r.id} elev="sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <CardKicker>{r.category}</CardKicker>
                    <div className="font-heading font-semibold text-[14px]">{r.subject}</div>
                  </div>
                  <Tag variant={REQUEST_TAG[r.status] as TagVariant}>{r.status.replace(/_/g, " ")}</Tag>
                </div>

                <div className="flex flex-col gap-2 mb-3">
                  {r.messages.map((m) => (
                    <div key={m.id} className="text-[12.5px] p-2 rounded-md bg-neutral-100">
                      <div>{m.body}</div>
                      <div className="text-[10.5px] text-neutral-500 mt-1">
                        {m.authorStaff?.name ?? "Candidate"} · {new Date(m.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  ))}
                </div>

                {r.status !== "RESOLVED" && (
                  <div className="flex gap-2">
                    <Textarea
                      value={replyBody[r.id] ?? ""}
                      onChange={(e) => setReplyBody({ ...replyBody, [r.id]: e.target.value })}
                      placeholder="Reply…"
                      rows={2}
                      className="flex-1"
                    />
                    <div className="flex flex-col gap-1.5">
                      <Button variant="primary" className="h-[31px] px-[11px] text-xs" disabled={busy || !replyBody[r.id]?.trim()} onClick={() => submitReply(r.id)}>
                        Reply
                      </Button>
                      <Button variant="secondary" className="h-[31px] px-[11px] text-xs" disabled={busy} onClick={() => submitResolve(r.id)}>
                        Resolve
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
