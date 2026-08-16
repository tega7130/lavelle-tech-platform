"use client";

import * as React from "react";
import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import type { listCandidates, DirectoryStatus } from "@/lib/candidate-admin-reads";
import { CandidateQuickViewModal } from "@/components/admin/candidate-quick-view-modal";

type Candidates = Awaited<ReturnType<typeof listCandidates>>["items"];

const STATUS_TAG: Record<DirectoryStatus, TagVariant | "success" | "warning" | "danger"> = {
  APPLICANT: "outline",
  ACTIVE: "success",
  AT_RISK: "warning",
  COMPLETED: "neutral",
  SUSPENDED: "danger",
};
const STATUS_LABEL: Record<DirectoryStatus, string> = {
  APPLICANT: "Applicant",
  ACTIVE: "Active",
  AT_RISK: "At risk",
  COMPLETED: "Completed",
  SUSPENDED: "Suspended",
};

const PAYMENT_TAG = { PAID: "success", UNPAID: "neutral", OUTSTANDING: "danger" } as const;
const PAYMENT_LABEL = { PAID: "Paid", UNPAID: "Unpaid", OUTSTANDING: "Outstanding" } as const;

export function CandidatesTable({ candidates }: { candidates: Candidates }) {
  const [quickViewId, setQuickViewId] = React.useState<string | null>(null);

  return (
    <>
      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Candidate</Th>
              <Th>Candidate / Applicant no.</Th>
              <Th>Programme</Th>
              <Th>Progress</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {candidates.map((c) => (
              <Tr key={c.id} onClick={() => setQuickViewId(c.id)} className="cursor-pointer">
                <Td className="pl-[var(--space-4)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-[11px] font-heading font-semibold flex-none">
                      {c.firstName[0]}
                      {c.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px]">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">{c.email}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-[13px]">
                  <div className="tabular-nums">{c.candidateNumber ?? c.applicantNumber}</div>
                  <div className="text-[10.5px] text-neutral-500">{c.candidateNumber ? "Candidate ID" : "Provisional applicant no."}</div>
                </Td>
                <Td className="text-[13px]">{c.programmeTitle ?? "Not enrolled"}</Td>
                <Td className="w-[120px]">
                  {c.percent == null ? (
                    <span className="text-neutral-500 text-[12px]">Not started</span>
                  ) : (
                    <div>
                      <div className="h-[6px] w-[84px] rounded-full bg-neutral-200 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${c.percent}%` }} />
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">{c.percent}%</div>
                    </div>
                  )}
                </Td>
                <Td>
                  <Tag variant={PAYMENT_TAG[c.payment]}>{PAYMENT_LABEL[c.payment]}</Tag>
                </Td>
                <Td>
                  <Tag variant={STATUS_TAG[c.status]}>{STATUS_LABEL[c.status]}</Tag>
                </Td>
                <Td className="text-right pr-[var(--space-4)]">
                  <Link
                    href={`/admin/candidates/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={buttonClassName("secondary", "h-[30px] px-[11px] text-[12px]")}
                  >
                    View
                  </Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {quickViewId && <CandidateQuickViewModal candidateId={quickViewId} onClose={() => setQuickViewId(null)} />}
    </>
  );
}
