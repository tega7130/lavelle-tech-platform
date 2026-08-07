import { getPaymentStatus } from "@/lib/catalogue-reads";
import { Card } from "@/components/ui/card";
import { CheckoutStatus } from "@/components/portal/checkout-status";

export default async function CheckoutReturnPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const payment = await getPaymentStatus(reference);

  return (
    <div className="max-w-[520px] mx-auto">
      <Card elev="md" className="p-[var(--space-6)]">
        <CheckoutStatus reference={reference} initial={payment} />
      </Card>
    </div>
  );
}
