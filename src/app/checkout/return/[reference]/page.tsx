import { notFound } from "next/navigation";
import { getGuestCheckoutStatus } from "@/lib/catalogue-reads";
import { Card } from "@/components/ui/card";
import { GuestCheckoutStatus } from "@/components/checkout/guest-checkout-status";

/**
 * The unauthenticated counterpart to /portal/checkout/[reference] — a
 * guest checkout has no session to reach that page's gate with, so this
 * one is public and scoped by the token in the query string instead
 * (never the reference alone — see getGuestCheckoutStatus).
 */
export default async function GuestCheckoutReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const payment = await getGuestCheckoutStatus(reference, token);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-[var(--space-6)]">
      <div className="w-full max-w-[520px]">
        <Card elev="md" className="p-[var(--space-6)]">
          <GuestCheckoutStatus reference={reference} token={token} initial={payment} />
        </Card>
      </div>
    </div>
  );
}
