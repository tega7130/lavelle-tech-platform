"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatNaira } from "@/lib/format";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";

interface PaymentRow {
  id: string;
  internalReference: string;
  provider: string;
  status: string;
  amountMinor: number;
  initiatedAt: Date;
  enrolment: { programme: { title: string; code: string } } | null;
  receiptUrl: string | null;
}

const PAYMENT_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
};

export function CandidatePaymentsTab({
  candidateId,
  candidateName,
  hasCandidateNumber,
  payments,
  stalePending,
  activeProgrammes,
}: {
  candidateId: string;
  candidateName: string;
  hasCandidateNumber: boolean;
  payments: PaymentRow[];
  stalePending: boolean;
  activeProgrammes: { id: string; title: string; code: string }[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<PaymentRow | null>(null);
  const [freshProgrammeId, setFreshProgrammeId] = React.useState("");
  const [recordingFresh, setRecordingFresh] = React.useState(false);

  const freshProgramme = activeProgrammes.find((p) => p.id === freshProgrammeId);

  return (
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
                <Th>Initiated</Th>
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
                  <Td className="text-[12px] text-neutral-600">
                    {p.initiatedAt.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
                    <br />
                    {p.initiatedAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </Td>
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

      {!hasCandidateNumber && (
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

      {confirming && (
        <RecordPaymentDialog
          onClose={() => setConfirming(null)}
          onRecorded={() => {
            setConfirming(null);
            router.refresh();
          }}
          existing={{
            paymentId: confirming.id,
            candidateName,
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
          fresh={{ candidateId, programmeId: freshProgramme.id, candidateName, programmeName: freshProgramme.title }}
        />
      )}
    </div>
  );
}
