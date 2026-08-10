"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea } from "@/components/ui/field";
import {
  listMyRequestsAction,
  getMyRequestThreadAction,
  submitCandidateRequestAction,
  submitCandidateReplyAction,
} from "@/app/actions/support";
import type { listMyRequests, getMyRequestThread } from "@/lib/support-reads";
import type { RequestCategory } from "@/generated/prisma/client";

type RequestSummary = Awaited<ReturnType<typeof listMyRequests>>[number];
type Thread = NonNullable<Awaited<ReturnType<typeof getMyRequestThread>>>;

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "ENROLMENT", label: "Enrolment" },
  { value: "PAYMENT", label: "Payment" },
  { value: "TECHNICAL", label: "Technical access" },
  { value: "PROGRAMME", label: "Programme" },
  { value: "OTHER", label: "Other" },
];

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CandidateSupport({ candidateName }: { candidateName: string }) {
  const [tab, setTab] = React.useState<"form" | "threads">("form");

  // New request form
  const [category, setCategory] = React.useState("ENROLMENT");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sentRef, setSentRef] = React.useState<string | null>(null);

  // Your requests
  const [requests, setRequests] = React.useState<RequestSummary[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<Thread | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const loadRequests = React.useCallback(async () => {
    const list = await listMyRequestsAction();
    setRequests(list);
    return list;
  }, []);

  React.useEffect(() => {
    if (tab === "threads" && requests === null) {
      void loadRequests().then((list) => {
        if (list.length > 0) setSelectedId(list[0]!.id);
      });
    }
  }, [tab, requests, loadRequests]);

  const loadThread = React.useCallback(async (id: string) => {
    const t = await getMyRequestThreadAction(id);
    setThread(t);
    setReply("");
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  async function submitNewRequest() {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const created = await submitCandidateRequestAction({ subject, category: category as RequestCategory, body });
      setSentRef(`LVL-REQ-${created.id.slice(0, 8).toUpperCase()}`);
      setSubject("");
      setBody("");
      setRequests(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    try {
      await submitCandidateReplyAction(selectedId, reply);
      await loadThread(selectedId);
      setRequests(null);
      void loadRequests();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1100px]">
      <Segmented
        name="suptab"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        options={[
          { value: "form", label: "New request" },
          { value: "threads", label: "Your requests" },
        ]}
        className="w-fit mb-[var(--space-5)]"
      />

      {tab === "form" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-[var(--space-8)]">
          <div>
            <h2 className="mb-1">How can we help?</h2>
            <p className="text-neutral-600 text-sm max-w-[52ch]">
              A Lavelle representative will be glad to assist with enrolment, payments, technical access, or any
              question about your programme.
            </p>

            <Card elev="sm" className="mt-[var(--space-4)] p-5 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={candidateName} readOnly disabled />
              </div>
              <div>
                <Label>Category</Label>
                <Segmented name="cat" value={category} onChange={setCategory} options={CATEGORIES} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary of your enquiry" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell us what you need help with…" />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" disabled={submitting || !subject.trim() || !body.trim()} onClick={submitNewRequest}>
                  {submitting ? "Sending…" : "Send request"}
                </Button>
              </div>
              {sentRef && (
                <div className="mt-1 px-4 py-3 rounded-md bg-accent-100 border border-accent-200 text-[13px] text-accent-700">
                  Thank you — your request has been logged as {sentRef}. A representative will respond shortly.
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card elev="sm" className="p-5">
              <CardKicker>Other ways to reach us</CardKicker>
              <div className="text-neutral-600 text-[12.5px] mt-2 leading-relaxed">
                Office hours: Monday to Friday, 9am – 5pm WAT. Every request raised here is answered by email and in
                your Notifications.
              </div>
            </Card>
            <button
              onClick={() => setTab("threads")}
              className="inline-block text-[12.5px] font-medium text-accent mt-3 hover:underline cursor-pointer"
            >
              Open a request to reply →
            </button>
          </div>
        </div>
      )}

      {tab === "threads" && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-[var(--space-6)] items-start">
          <div className="border border-divider rounded-md overflow-hidden">
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase px-4 py-3 border-b border-dashed border-neutral-300">
              Your requests
            </div>
            <div className="flex flex-col">
              {(requests ?? []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`block text-left px-4 py-3 border-b border-dashed border-neutral-300 cursor-pointer hover:bg-neutral-100 ${r.id === selectedId ? "bg-accent-100" : ""}`}
                >
                  <div className="flex justify-between items-baseline gap-2.5">
                    <span className="text-[12.5px] font-medium truncate">{r.subject}</span>
                    <Tag variant={STATUS_TAG[r.status] as TagVariant} className="flex-none text-[9.5px]">
                      {r.status.replace(/_/g, " ")}
                    </Tag>
                  </div>
                  <div className="text-neutral-500 text-[11px] mt-[3px]">{fmtDate(r.createdAt)}</div>
                </button>
              ))}
              {requests !== null && requests.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="font-heading font-semibold text-[13px]">No open requests</div>
                  <div className="text-neutral-500 text-[11.5px] mt-1">
                    Requests you raise appear here with their status.
                  </div>
                </div>
              )}
            </div>
          </div>

          {thread && (
            <Card elev="sm" className="p-5 gap-0">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <CardKicker>LVL-REQ-{thread.id.slice(0, 8).toUpperCase()}</CardKicker>
                  <div className="font-heading font-semibold text-[16px] mt-0.5">{thread.subject}</div>
                </div>
                <Tag variant={STATUS_TAG[thread.status] as TagVariant} className="font-semibold">
                  {thread.status.replace(/_/g, " ")}
                </Tag>
              </div>

              <div className="flex flex-col gap-3 mt-5 pt-4 border-t border-dashed border-neutral-300">
                {thread.messages.map((m) => {
                  const fromCandidate = !!m.authorCandidateId;
                  const author = fromCandidate ? "You" : m.authorStaff?.name ?? "Lavelle";
                  return (
                    <div key={m.id} className={`flex ${fromCandidate ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[82%] px-4 py-3 rounded-md border ${fromCandidate ? "bg-accent-100 border-accent-200" : "bg-neutral-100 border-divider"}`}
                      >
                        <div className="flex items-baseline gap-2.5 flex-wrap">
                          <span className="font-heading font-semibold text-[12px]">{author}</span>
                          <span className="text-neutral-500 text-[10.5px]">{fmtDate(m.createdAt)}</span>
                        </div>
                        <div className="text-[13px] leading-relaxed mt-1">{m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {thread.status === "RESOLVED" && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-md bg-[#e7f6ed] border border-[#bfe3cd] mt-4">
                  <span className="flex-none text-[#15803d] font-bold">✓</span>
                  <div className="text-[12.5px] leading-relaxed text-[#116632]">
                    This request was closed by {thread.resolvedByStaff?.name ?? "a representative"}. If it is not
                    fully settled, reply below and it reopens automatically — you do not need to start a new request.
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label>{thread.status === "RESOLVED" ? "Reply and reopen this request" : "Add a reply"}</Label>
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add anything that would help us close this properly…" />
              </div>
              <div className="flex justify-between items-center gap-4 flex-wrap mt-2">
                <span className="text-neutral-500 text-[11.5px] max-w-[46ch]">
                  {thread.status === "RESOLVED" ? "Replying reopens the request and notifies the representative who closed it." : ""}
                </span>
                <Button variant="primary" disabled={busy || !reply.trim()} onClick={sendReply} className="flex-none">
                  Send reply
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
