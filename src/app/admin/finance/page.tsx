import { listLedger, countStalePendingPayments, getFinanceKpis } from "@/lib/finance-reads";
import { getSignedAssetUrl } from "@/lib/storage";
import { formatNaira } from "@/lib/format";
import { Card, CardKicker } from "@/components/ui/card";
import { FinanceLedger, type LedgerRow } from "@/components/admin/finance-ledger";

function ageHoursSincePending(status: string, initiatedAt: Date): number | null {
  if (status !== "PENDING") return null;
  return (Date.now() - initiatedAt.getTime()) / (1000 * 60 * 60);
}

export default async function FinancePage() {
  const [payments, stalePending, kpis] = await Promise.all([listLedger(), countStalePendingPayments(), getFinanceKpis()]);

  const rows: LedgerRow[] = payments.map((p) => {
    const ageHours = ageHoursSincePending(p.status, p.initiatedAt);
    return {
      id: p.id,
      internalReference: p.internalReference,
      candidateName: p.candidate
        ? `${p.candidate.firstName} ${p.candidate.lastName}`
        : p.guestCheckout
          ? `${p.guestCheckout.firstName} ${p.guestCheckout.lastName} (guest checkout, pending)`
          : "—",
      programmeName: p.enrolment?.programme.title ?? "—",
      channel: p.offlineMode ? p.offlineMode.replace(/_/g, " ").toLowerCase() : p.provider,
      amountMinor: p.amountMinor,
      status: p.status,
      ageHours,
      receiptUrl: p.receiptAsset ? getSignedAssetUrl(p.receiptAsset.storageKey, "raw") : null,
      confirmedByName: p.confirmedByStaff?.name ?? null,
    };
  });

  const KPIS = [
    { label: "Collected · this month", value: formatNaira(kpis.collectedMinor), meta: `${kpis.collectedCount} transactions` },
    { label: "Outstanding", value: formatNaira(kpis.outstandingMinor), meta: `${kpis.outstandingCount} pending` },
    { label: "Refunds", value: formatNaira(kpis.refundedMinor), meta: `${kpis.refundedCount} processed` },
  ];

  return (
    <div className="max-w-[1280px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Finance</h1>

      <div className="grid grid-cols-3 gap-[var(--space-4)] mb-[var(--space-6)]">
        {KPIS.map((k) => (
          <Card key={k.label} elev="sm">
            <CardKicker>{k.label}</CardKicker>
            <div className="font-heading font-bold text-[26px] mt-1">{k.value}</div>
            <div className="text-neutral-500 text-xs">{k.meta}</div>
          </Card>
        ))}
      </div>

      <h3 className="mb-[var(--space-3)]">Transactions</h3>
      <FinanceLedger rows={rows} stalePending={stalePending} />
    </div>
  );
}
