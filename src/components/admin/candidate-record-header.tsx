"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { suspendCandidateAction, reactivateCandidateAction } from "@/app/actions/candidate-admin";

export const CANDIDATE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "enrolments", label: "Enrolments" },
  { key: "payments", label: "Payments" },
  { key: "progress", label: "Progress" },
  { key: "assessments", label: "Assessments" },
  { key: "certificates", label: "Certificates" },
  { key: "notes", label: "Notes & requests" },
  { key: "audit", label: "Audit log" },
] as const;

export function CandidateRecordHeader({
  candidateId,
  name,
  applicantNumber,
  candidateNumber,
  email,
  isSuspended,
  suspendedReason,
  canViewPayments,
}: {
  candidateId: string;
  name: string;
  applicantNumber: string;
  candidateNumber: string | null;
  email: string;
  isSuspended: boolean;
  suspendedReason: string | null;
  canViewPayments: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = React.useState(false);
  const [suspending, setSuspending] = React.useState(false);
  const [suspendReason, setSuspendReason] = React.useState("");

  const visibleTabs = canViewPayments ? CANDIDATE_TABS : CANDIDATE_TABS.filter((t) => t.key !== "payments");

  async function submitSuspend() {
    if (!suspendReason.trim()) return;
    setBusy(true);
    try {
      await suspendCandidateAction(candidateId, suspendReason);
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
      await reactivateCandidateAction(candidateId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-[var(--space-4)]">
        <div className="w-[52px] h-[52px] rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-heading font-bold text-lg">
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="flex-1">
          <div className="font-heading text-xl">{name}</div>
          <div className="text-neutral-600 text-[12.5px]">
            {candidateNumber ?? applicantNumber} &middot; {email}
          </div>
        </div>
        <Tag variant={candidateNumber ? "success" : "neutral"}>{candidateNumber ? "Enrolled" : "Applicant"}</Tag>
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
      {isSuspended && suspendedReason && (
        <p className="text-[12.5px] text-neutral-600 -mt-2 mb-[var(--space-4)]">Suspended: {suspendedReason}</p>
      )}

      <div className="flex gap-1 border-b border-divider mb-[var(--space-4)]">
        {visibleTabs.map((t) => {
          const href = `/admin/candidates/${candidateId}/${t.key}`;
          const active = pathname === href;
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px no-underline",
                active ? "border-accent text-accent" : "border-transparent text-neutral-600 hover:text-text"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

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
    </>
  );
}
