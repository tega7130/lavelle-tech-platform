"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { formatNaira } from "@/lib/format";

export interface LedgerRow {
  id: string;
  internalReference: string;
  candidateName: string;
  programmeName: string;
  channel: string;
  amountMinor: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  ageHours: number | null;
  receiptUrl: string | null;
  confirmedByName: string | null;
}

const STATUS_TAG: Record<LedgerRow["status"], { variant: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  PENDING: { variant: "warning", label: "Pending" },
  SUCCESS: { variant: "success", label: "Settled" },
  FAILED: { variant: "danger", label: "Declined" },
  REFUNDED: { variant: "neutral", label: "Refunded" },
};

export function FinanceLedger({ rows, stalePending }: { rows: LedgerRow[]; stalePending: number }) {
  const router = useRouter();
  const [recording, setRecording] = React.useState<LedgerRow | null>(null);

  return (
    <div>
      {stalePending > 0 && (
        <div className="flex items-start gap-3 p-[var(--space-4)] rounded-md bg-[#fff7e6] border border-[#f0d9a8] mb-[var(--space-4)]">
          <span className="flex-none w-[26px] h-[26px] rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-sm font-bold">
            !
          </span>
          <div>
            <div className="font-heading font-semibold text-[13.5px] text-[#7a4d06]">
              {stalePending} {stalePending === 1 ? "payment has" : "payments have"} been pending over 48 hours
            </div>
            <div className="text-[12.5px] text-[#8a6013] mt-0.5">
              These candidates report having paid but the provider has not confirmed. Verify each against the bank
              statement before recording it — recording a payment issues a candidate number and cannot be undone.
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-12 px-4 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No transactions in this period</div>
          <p className="text-neutral-600 text-[12.5px] mt-2">Widen the date range or clear the provider filter.</p>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Reference</Th>
                <Th>Candidate</Th>
                <Th>Programme</Th>
                <Th>Channel</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th className="text-right pr-[var(--space-4)]">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.id} className={r.status === "PENDING" ? "bg-[#fffdf7]" : undefined}>
                  <Td className="pl-[var(--space-4)] tabular-nums text-[13px]">{r.internalReference}</Td>
                  <Td className="text-[13px]">{r.candidateName}</Td>
                  <Td className="text-[13px]">{r.programmeName}</Td>
                  <Td className="text-[13px]">
                    {r.channel}
                    {r.receiptUrl && (
                      <div className="text-[11px] mt-0.5">
                        <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="text-accent">
                          View receipt
                        </a>
                      </div>
                    )}
                  </Td>
                  <Td className="tabular-nums text-[13px]">{formatNaira(r.amountMinor)}</Td>
                  <Td>
                    <Tag variant={STATUS_TAG[r.status].variant}>{STATUS_TAG[r.status].label}</Tag>
                    {r.ageHours != null && r.ageHours > 48 && (
                      <div className="text-[10.5px] text-[#a16207] mt-0.5">
                        Pending {Math.floor(r.ageHours / 24)} day{Math.floor(r.ageHours / 24) === 1 ? "" : "s"}
                      </div>
                    )}
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    {r.status === "PENDING" && (
                      <Button
                        variant="primary"
                        className="h-[30px] px-[11px] text-[11.5px]"
                        onClick={() =>
                          setRecording({
                            ...r,
                          })
                        }
                      >
                        Record payment
                      </Button>
                    )}
                    {r.status === "SUCCESS" && r.confirmedByName && (
                      <span className="text-neutral-500 text-[11px]">Recorded by {r.confirmedByName}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {recording && (
        <RecordPaymentDialog
          onClose={() => setRecording(null)}
          onRecorded={() => {
            setRecording(null);
            router.refresh();
          }}
          existing={{
            paymentId: recording.id,
            candidateName: recording.candidateName,
            programmeName: recording.programmeName,
            expectedLabel: formatNaira(recording.amountMinor),
          }}
        />
      )}
    </div>
  );
}
