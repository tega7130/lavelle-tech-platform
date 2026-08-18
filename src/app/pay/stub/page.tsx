import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { formatNaira } from "@/lib/format";
import { simulateProviderSuccess, simulateProviderDecline } from "@/app/actions/payment-stub";

/**
 * Local dev substitute for a real provider's hosted checkout page (see
 * src/lib/payment-provider.ts) — no external account is configured, so
 * this page stands in for it. The buttons below deliver a genuinely
 * signed webhook to this app's own /api/webhooks/[provider] route, the
 * same way a real provider's server would, then land on the return page,
 * which polls actual payment status rather than trusting anything in
 * this URL (rule 6).
 */
export default async function PaymentStubPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; ref?: string; amount?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const provider = sp.provider ?? "paystack";
  const reference = sp.ref ?? "";
  const amountMinor = Number(sp.amount ?? 0);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-[var(--space-6)]">
      <Card elev="lg" className="w-full max-w-[420px] p-[var(--space-6)] gap-[var(--space-4)]">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <div>
            <CardTitle>Lavelle checkout — dev simulator</CardTitle>
            <div className="text-[11px] text-neutral-500">
              Standing in for {provider} — no real account is configured
            </div>
          </div>
        </div>

        <div className="border-t border-dashed border-neutral-300 pt-[var(--space-4)]">
          <CardKicker>Amount</CardKicker>
          <div className="font-heading text-2xl">{formatNaira(amountMinor)}</div>
          <div className="text-[11.5px] text-neutral-500 mt-1">Reference {reference}</div>
        </div>

        <p className="text-[12.5px] text-neutral-600 leading-relaxed">
          This page exists only because no real payment provider is connected in this environment. Choosing
          either option below delivers a signed webhook to this app exactly as {provider} would, then returns
          you to Lavelle — the return page still verifies the outcome itself rather than trusting this URL.
        </p>

        <div className="flex flex-col gap-2">
          <form action={simulateProviderSuccess.bind(null, provider, reference)}>
            <Button type="submit" variant="primary" block>
              Simulate successful payment
            </Button>
          </form>
          <form action={simulateProviderDecline.bind(null, provider, reference)}>
            <Button type="submit" variant="secondary" block>
              Simulate declined payment
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
