"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { tierLabel } from "@/lib/format";
import { markEnrolmentRefunded } from "@/app/actions/payment";
import type { listCandidateEnrolments } from "@/lib/finance-reads";

type Enrolment = Awaited<ReturnType<typeof listCandidateEnrolments>>[number];

const ENROLMENT_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  COMPLETED: "outline",
  PENDING_PAYMENT: "warning",
  WITHDRAWN: "neutral",
  REFUNDED: "danger",
};

export function CandidateEnrolmentsTab({ enrolments }: { enrolments: Enrolment[] }) {
  const router = useRouter();
  const [refunding, setRefunding] = React.useState<Enrolment | null>(null);
  const [refundReason, setRefundReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

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

  if (enrolments.length === 0) {
    return (
      <div className="text-center py-12 px-6 border border-divider rounded-md">
        <div className="font-heading font-semibold text-[15px]">No enrolments yet</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">
          This candidate has not paid for a programme. Enrolment records appear here once payment is confirmed.
        </p>
      </div>
    );
  }

  return (
    <>
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
                  {e.intake ? `${e.intake.month} ${e.intake.year}` : "—"}
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
    </>
  );
}
