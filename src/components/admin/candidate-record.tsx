"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { formatNaira, tierLabel } from "@/lib/format";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { markEnrolmentRefunded } from "@/app/actions/payment";
import { suspendCandidateAction, reactivateCandidateAction } from "@/app/actions/candidate-admin";
import type { getCandidateForAdmin } from "@/lib/candidate-admin-reads";
import type { listCandidateEnrolments } from "@/lib/finance-reads";
import type { listCandidateMarks } from "@/lib/marking-reads";

type Candidate = NonNullable<Awaited<ReturnType<typeof getCandidateForAdmin>>>;
type Enrolment = Awaited<ReturnType<typeof listCandidateEnrolments>>[number];
type CandidateMarks = Awaited<ReturnType<typeof listCandidateMarks>>;

const BAND_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  MERIT: "accent",
  PASS: "warning",
  REFER: "danger",
};
const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };
interface PaymentRow {
  id: string;
  internalReference: string;
  provider: string;
  status: string;
  amountMinor: number;
  enrolment: { programme: { title: string; code: string } } | null;
  receiptUrl: string | null;
}

const ENROLMENT_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  COMPLETED: "outline",
  PENDING_PAYMENT: "warning",
  WITHDRAWN: "neutral",
  REFUNDED: "danger",
};

const PAYMENT_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "enrolments", label: "Enrolments" },
  { key: "payments", label: "Payments" },
  { key: "grades", label: "Assessments & grades" },
] as const;

export function CandidateRecord({
  candidate,
  enrolments,
  payments,
  stalePending,
  activeProgrammes,
  marks,
}: {
  candidate: Candidate;
  enrolments: Enrolment[];
  payments: PaymentRow[];
  stalePending: boolean;
  activeProgrammes: { id: string; title: string; code: string }[];
  marks: CandidateMarks;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("overview");
  const [refunding, setRefunding] = React.useState<Enrolment | null>(null);
  const [refundReason, setRefundReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState<PaymentRow | null>(null);
  const [freshProgrammeId, setFreshProgrammeId] = React.useState("");
  const [recordingFresh, setRecordingFresh] = React.useState(false);
  const [suspending, setSuspending] = React.useState(false);
  const [suspendReason, setSuspendReason] = React.useState("");

  const name = `${candidate.firstName} ${candidate.lastName}`;
  const isSuspended = candidate.accountStatus === "SUSPENDED";

  async function submitSuspend() {
    if (!suspendReason.trim()) return;
    setBusy(true);
    try {
      await suspendCandidateAction(candidate.id, suspendReason);
      setSuspending(false);
      setSuspendReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitReactivate() {
    setBusy(true);
    try {
      await reactivateCandidateAction(candidate.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund() {
    if (!refunding || !refundReason.trim()) return;
    setBusy(true);
    try {
      await markEnrolmentRefunded(refunding.id, refundReason);
      setRefunding(null);
      setRefundReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const freshProgramme = activeProgrammes.find((p) => p.id === freshProgrammeId);

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-center gap-4 mb-[var(--space-4)]">
        <div className="w-[52px] h-[52px] rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-heading font-bold text-lg">
          {candidate.firstName[0]}
          {candidate.lastName[0]}
        </div>
        <div className="flex-1">
          <div className="font-heading text-xl">{name}</div>
          <div className="text-neutral-600 text-[12.5px]">
            {candidate.candidateNumber ?? candidate.applicantNumber} &middot; {candidate.email}
          </div>
        </div>
        <Tag variant={candidate.candidateNumber ? "success" : "neutral"}>
          {candidate.candidateNumber ? "Enrolled" : "Applicant"}
        </Tag>
        {isSuspended && <Tag variant="danger">Suspended</Tag>}
        {isSuspended ? (
          <Button variant="secondary" className="h-[31px] px-[11px] text-xs" disabled={busy} onClick={submitReactivate}>
            Reactivate
          </Button>
        ) : (
          <Button variant="secondary" className="h-[31px] px-[11px] text-xs" onClick={() => setSuspending(true)}>
            Suspend
          </Button>
        )}
      </div>
      {isSuspended && candidate.suspendedReason && (
        <p className="text-[12.5px] text-neutral-600 -mt-2 mb-[var(--space-4)]">Suspended: {candidate.suspendedReason}</p>
      )}

      <div className="flex gap-1 border-b border-divider mb-[var(--space-4)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px cursor-pointer ${
              tab === t.key ? "border-accent text-accent" : "border-transparent text-neutral-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card elev="sm">
          <CardKicker>Identity</CardKicker>
          <div className="grid grid-cols-2 gap-3 mt-2 text-[13px]">
            <div>
              <div className="text-neutral-500 text-xs">Applicant number</div>
              <div className="tabular-nums">{candidate.applicantNumber}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Candidate number</div>
              <div className="tabular-nums">{candidate.candidateNumber ?? "Not yet issued"}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Email</div>
              <div>{candidate.email}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Phone</div>
              <div>
                {candidate.phoneCountryCode} {candidate.phone ?? "—"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "enrolments" &&
        (enrolments.length === 0 ? (
          <div className="text-center py-12 px-6 border border-divider rounded-md">
            <div className="font-heading font-semibold text-[15px]">No enrolments yet</div>
            <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">
              This candidate has not paid for a programme. Enrolment records appear here once payment is confirmed.
            </p>
          </div>
        ) : (
          <div className="border border-divider rounded-md overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th className="pl-[var(--space-4)]">Programme</Th>
                  <Th>Level</Th>
                  <Th>Intake</Th>
                  <Th>Cohort</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-[var(--space-4)]">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {enrolments.map((e) => (
                  <Tr key={e.id}>
                    <Td className="pl-[var(--space-4)] font-medium">{e.programme.title}</Td>
                    <Td>{tierLabel(e.programme.tier)}</Td>
                    <Td>
                      {e.intake.month} {e.intake.year}
                    </Td>
                    <Td className="text-neutral-600">{e.cohort?.code ?? "—"}</Td>
                    <Td>
                      <Tag variant={ENROLMENT_TAG[e.status] as TagVariant}>{e.status.replace(/_/g, " ")}</Tag>
                    </Td>
                    <Td className="text-right pr-[var(--space-4)]">
                      {(e.status === "ACTIVE" || e.status === "PENDING_PAYMENT") && (
                        <Button variant="secondary" className="h-[31px] px-[11px] text-xs" onClick={() => setRefunding(e)}>
                          Refund
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        ))}

      {tab === "payments" && (
        <div>
          {stalePending && (
            <div className="flex items-center gap-3 p-3.5 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mb-[var(--space-4)] text-[12.5px] text-[#8a6013]">
              One payment has been pending for more than 48 hours. Confirm with the provider before manually confirming
              enrolment.
            </div>
          )}
          {payments.length === 0 ? (
            <div className="text-center py-12 px-6 border border-divider rounded-md">
              <div className="font-heading font-semibold text-[15px]">No payments recorded</div>
            </div>
          ) : (
            <div className="border border-divider rounded-md overflow-hidden">
              <Table>
                <Thead>
                  <Tr>
                    <Th className="pl-[var(--space-4)]">Programme</Th>
                    <Th>Amount</Th>
                    <Th>Provider</Th>
                    <Th>Reference</Th>
                    <Th>Status</Th>
                    <Th className="text-right pr-[var(--space-4)]">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td className="pl-[var(--space-4)] font-medium">{p.enrolment?.programme.title ?? "—"}</Td>
                      <Td className="tabular-nums">{formatNaira(p.amountMinor)}</Td>
                      <Td>{p.provider}</Td>
                      <Td className="text-[12px] text-neutral-600">{p.internalReference}</Td>
                      <Td>
                        <Tag variant={PAYMENT_TAG[p.status] as TagVariant}>{p.status}</Tag>
                      </Td>
                      <Td className="text-right pr-[var(--space-4)]">
                        <div className="flex gap-1.5 justify-end">
                          {p.status === "PENDING" && (
                            <Button variant="primary" className="h-[31px] px-[11px] text-xs" onClick={() => setConfirming(p)}>
                              Manually confirm
                            </Button>
                          )}
                          {p.receiptUrl && (
                            <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-accent text-xs self-center">
                              View receipt
                            </a>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}

          {!candidate.candidateNumber && (
            <div className="mt-[var(--space-4)] flex items-center gap-2">
              <select
                className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                value={freshProgrammeId}
                onChange={(e) => setFreshProgrammeId(e.target.value)}
              >
                <option value="">Select a programme…</option>
                {activeProgrammes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
              <Button variant="secondary" disabled={!freshProgrammeId} onClick={() => setRecordingFresh(true)}>
                Record payment
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "grades" && (
        <div className="flex flex-col gap-[var(--space-4)]">
          <Card elev="sm" className="p-0 gap-0 overflow-x-auto">
            <h4 className="m-0 px-[var(--space-4)] pt-[var(--space-4)] pb-2 font-heading font-semibold text-[15px]">Quizzes</h4>
            {marks.quizzes.length === 0 ? (
              <div className="text-neutral-500 text-[12.5px] px-[var(--space-4)] pb-[var(--space-4)]">No quiz attempts yet.</div>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th className="pl-[var(--space-4)]">Module</Th>
                    <Th>Score</Th>
                    <Th>Date taken</Th>
                    <Th>Attempts</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {marks.quizzes.map((q, i) => (
                    <Tr key={i}>
                      <Td className="pl-[var(--space-4)] font-medium">{q.module}</Td>
                      <Td className="tabular-nums">{q.scorePercent != null ? `${q.scorePercent}%` : "—"}</Td>
                      <Td>{q.date?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
                      <Td>{q.attempts}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>

          <Card elev="sm" className="p-0 gap-0 overflow-x-auto">
            <h4 className="m-0 px-[var(--space-4)] pt-[var(--space-4)] pb-2 font-heading font-semibold text-[15px]">Drafting exercises</h4>
            {marks.drafting.length === 0 ? (
              <div className="text-neutral-500 text-[12.5px] px-[var(--space-4)] pb-[var(--space-4)]">No drafting exercises submitted yet.</div>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th className="pl-[var(--space-4)]">Lecture</Th>
                    <Th>Submitted</Th>
                    <Th>Grade</Th>
                    <Th>Graded by</Th>
                    <Th>Graded date</Th>
                    <Th className="text-right pr-[var(--space-4)]"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {marks.drafting.map((d) => (
                    <Tr key={d.id}>
                      <Td className="pl-[var(--space-4)] font-medium">{d.lecture}</Td>
                      <Td>{d.submittedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—"}</Td>
                      <Td>
                        {d.state === "RETURNED" ? (
                          <Tag variant={(d.band ? BAND_TAG[d.band] : "neutral") as TagVariant}>
                            {d.scorePercent}% — {d.band ? BAND_LABEL[d.band] : ""}
                          </Tag>
                        ) : (
                          <Tag variant="warning">Pending review</Tag>
                        )}
                      </Td>
                      <Td className="text-neutral-600">{d.markedByName ?? "—"}</Td>
                      <Td className="text-neutral-600">
                        {d.markedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "—"}
                      </Td>
                      <Td className="text-right pr-[var(--space-4)]">
                        {d.state !== "RETURNED" && (
                          <a href="/admin/marking">
                            <Button variant="primary" className="h-[31px] px-[11px] text-xs">
                              Grade now
                            </Button>
                          </a>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {confirming && (
        <RecordPaymentDialog
          onClose={() => setConfirming(null)}
          onRecorded={() => {
            setConfirming(null);
            router.refresh();
          }}
          existing={{
            paymentId: confirming.id,
            candidateName: name,
            programmeName: confirming.enrolment?.programme.title ?? "",
            expectedLabel: formatNaira(confirming.amountMinor),
          }}
        />
      )}

      {recordingFresh && freshProgramme && (
        <RecordPaymentDialog
          onClose={() => setRecordingFresh(false)}
          onRecorded={() => {
            setRecordingFresh(false);
            router.refresh();
          }}
          fresh={{ candidateId: candidate.id, programmeId: freshProgramme.id, candidateName: name, programmeName: freshProgramme.title }}
        />
      )}

      {refunding && (
        <Dialog open onClose={() => setRefunding(null)} title="Refund this enrolment?">
          <p>
            This records the enrolment as refunded and writes the reason to the audit log. The refund itself is
            settled outside the platform — Lavelle holds no candidate balances.
          </p>
          <Textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="e.g. Duplicate payment for the same programme"
            rows={2}
            className="mt-3"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !refundReason.trim()} onClick={submitRefund}>
              Process refund
            </Button>
          </div>
        </Dialog>
      )}

      {suspending && (
        <Dialog open onClose={() => setSuspending(false)} title="Suspend this account?">
          <p>
            The candidate is signed out everywhere immediately and cannot sign back in until reactivated. Any
            deadline that falls during the suspension is extended by its length on reactivation.
          </p>
          <Textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Reason for suspension"
            rows={2}
            className="mt-3"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setSuspending(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !suspendReason.trim()} onClick={submitSuspend}>
              Suspend account
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
