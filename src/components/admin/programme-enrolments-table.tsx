"use client";

import * as React from "react";
import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea, Input } from "@/components/ui/field";
import { resetEnrolmentProgressAction } from "@/app/actions/enrolment-admin";
import type { ProgrammeEnrolmentRow, EnrolmentProgressStatus } from "@/lib/enrolment-reads";

const STATUS_TAG: Record<EnrolmentProgressStatus, TagVariant | "success" | "warning" | "danger"> = {
  not_started: "neutral",
  in_progress: "warning",
  completed: "success",
};
const STATUS_LABEL: Record<EnrolmentProgressStatus, string> = {
  not_started: "Yet to start",
  in_progress: "In progress",
  completed: "Completed",
};
const STATUS_FILTERS: { value: EnrolmentProgressStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Yet to start" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(rows: ProgrammeEnrolmentRow[]) {
  const header = ["Name", "Email", "Phone", "Applicant no.", "Candidate no.", "Status", "Progress %", "Enrolled", "Completed", "Last activity", "Certificate issued"];
  const lines = rows.map((r) =>
    [
      r.candidateName,
      r.email,
      r.phone ?? "",
      r.applicantNumber,
      r.candidateNumber ?? "",
      STATUS_LABEL[r.status],
      String(r.progressPercent),
      formatDate(r.enrolledAt),
      formatDate(r.completedAt),
      formatDate(r.lastActivityAt),
      r.certificateIssued ? "Yes" : "No",
    ]
      .map(csvEscape)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "enrolments.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ProgrammeEnrolmentsTable({ rows: initial, canReset }: { rows: ProgrammeEnrolmentRow[]; canReset: boolean }) {
  const [rows, setRows] = React.useState(initial);
  const [statusFilter, setStatusFilter] = React.useState<EnrolmentProgressStatus | "all">("all");
  const [q, setQ] = React.useState("");
  const [resetting, setResetting] = React.useState<ProgrammeEnrolmentRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const haystack = `${r.candidateName} ${r.email} ${r.applicantNumber} ${r.candidateNumber ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  async function confirmReset() {
    if (!resetting || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await resetEnrolmentProgressAction(resetting.enrolmentId, reason);
      setRows((rs) =>
        rs.map((r) =>
          r.enrolmentId === resetting.enrolmentId
            ? { ...r, status: "not_started", progressPercent: 0, completedLectures: 0, completedAt: null, lastActivityAt: null }
            : r
        )
      );
      setResetting(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset this candidate's progress.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-[12.5px] font-medium ${
                statusFilter === f.value ? "bg-accent-100 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input dense value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="w-[220px]" />
          <button onClick={() => exportCsv(filtered)} className={buttonClassName("secondary", "h-[34px] px-3 text-[12.5px]")}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Candidate</Th>
              <Th>Candidate / Applicant no.</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Enrolled</Th>
              <Th>Last activity</Th>
              <Th>Certificate</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((r) => (
              <Tr key={r.enrolmentId}>
                <Td className="pl-[var(--space-4)]">
                  <div className="text-[13px]">{r.candidateName}</div>
                  <div className="text-[11px] text-neutral-500 truncate">{r.email}</div>
                </Td>
                <Td className="text-[13px]">
                  <div className="tabular-nums">{r.candidateNumber ?? r.applicantNumber}</div>
                  <div className="text-[10.5px] text-neutral-500">{r.candidateNumber ? "Candidate ID" : "Provisional applicant no."}</div>
                </Td>
                <Td>
                  <Tag variant={STATUS_TAG[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                </Td>
                <Td className="w-[120px]">
                  <div className="h-[6px] w-[84px] rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${r.progressPercent}%` }} />
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                    {r.progressPercent}% · {r.completedLectures}/{r.totalLectures}
                  </div>
                </Td>
                <Td className="text-[12.5px] tabular-nums">{formatDate(r.enrolledAt)}</Td>
                <Td className="text-[12.5px] tabular-nums">{formatDate(r.lastActivityAt)}</Td>
                <Td>{r.certificateIssued ? <Tag variant="success">Issued</Tag> : <span className="text-neutral-400 text-[12px]">—</span>}</Td>
                <Td className="text-right pr-[var(--space-4)]">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/candidates/${r.candidateId}`} className={buttonClassName("secondary", "h-[30px] px-[11px] text-[12px]")}>
                      View
                    </Link>
                    {canReset && (
                      <Button
                        variant="secondary"
                        className="h-[30px] px-[11px] text-[12px] border-[#e8b4ae] text-[#b42318] hover:bg-[#fdecec]"
                        onClick={() => {
                          setResetting(r);
                          setError(null);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {filtered.length === 0 && <div className="text-center py-8 text-neutral-500 text-[13px]">No learners match those filters.</div>}

      <Dialog
        open={!!resetting}
        onClose={() => !busy && setResetting(null)}
        title={resetting ? `Reset ${resetting.candidateName}'s progress?` : ""}
        actions={
          <>
            <Button variant="secondary" onClick={() => setResetting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!reason.trim() || busy} onClick={confirmReset}>
              {busy ? "Resetting…" : "Reset progress"}
            </Button>
          </>
        }
      >
        <div className="mb-2">
          This clears every lecture, drafting, and quiz result the candidate has recorded in this programme, and regenerates their
          deadline schedule from today. This cannot be undone. Their enrolment and payment are not affected, and progress in any
          other programme is untouched.
        </div>
        {error && <div className="text-[#b42318] text-[12.5px] mb-2">{error}</div>}
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being reset?" />
      </Dialog>
    </>
  );
}
