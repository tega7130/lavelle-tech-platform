"use client";

import * as React from "react";
import Link from "next/link";
import { pollGuestCheckoutStatus } from "@/app/actions/payment";
import { buttonClassName } from "@/components/ui/button";

type GuestCheckoutStatusResult = Awaited<ReturnType<typeof pollGuestCheckoutStatus>>;

const POLL_INTERVAL_MS = 1500;

/**
 * The unauthenticated counterpart to CheckoutStatus — polls
 * getGuestCheckoutStatus (via the pollGuestCheckoutStatus Server Action)
 * scoped by reference + token together, never trusting anything else in
 * this page's URL (rule 6, same as the authenticated version). On
 * success there is deliberately no auto sign-in — the candidate signs in
 * with the email/password they just set at checkout.
 */
export function GuestCheckoutStatus({
  reference,
  token,
  initial,
}: {
  reference: string;
  token: string;
  initial: GuestCheckoutStatusResult;
}) {
  const [payment, setPayment] = React.useState(initial);

  React.useEffect(() => {
    if (!payment || payment.status !== "PENDING") return;
    const id = setInterval(async () => {
      const next = await pollGuestCheckoutStatus(reference, token);
      setPayment(next);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [payment, reference, token]);

  if (!payment) {
    return (
      <div className="text-center py-8">
        <div className="font-heading font-semibold text-[15px]">We could not find that payment</div>
        <p className="text-neutral-600 text-[12.5px] mt-2">The link may be out of date or incomplete.</p>
        <Link href="/programmes" className={buttonClassName("primary", "mt-4")}>
          Browse specializations
        </Link>
      </div>
    );
  }

  if (payment.status === "PENDING") {
    return (
      <div className="text-center py-8">
        <div className="w-11 h-11 mx-auto relative">
          <div className="absolute inset-0 rounded-full border-[2.5px] border-neutral-200 border-t-accent animate-spin" />
        </div>
        <div className="font-heading font-semibold text-sm mt-4">Confirming your payment</div>
        <div className="text-neutral-500 text-xs mt-1">One moment — this updates automatically.</div>
      </div>
    );
  }

  if (payment.status === "SUCCESS") {
    return (
      <div className="text-center py-8">
        <div className="w-[52px] h-[52px] mx-auto rounded-full bg-[#e7f6ed] border border-[#bfe3cd] text-[#15803d] flex items-center justify-center text-xl font-bold">
          ✓
        </div>
        <div className="font-heading font-semibold text-[17px] mt-4">Payment confirmed</div>
        <p className="text-neutral-600 text-[13px] mt-2 max-w-[42ch] mx-auto">
          {payment.programme?.title
            ? `Your payment for ${payment.programme.title} has been confirmed and your candidate account has been created.`
            : "Your payment has been confirmed and your candidate account has been created."}{" "}
          Sign in with <strong className="font-semibold text-text">{payment.email}</strong> to get started.
        </p>
        <Link href={`/sign-in?email=${encodeURIComponent(payment.email)}`} className={buttonClassName("primary", "mt-5")}>
          Sign in to your portal
        </Link>
      </div>
    );
  }

  // FAILED
  return (
    <div className="text-center py-8">
      <div className="w-[52px] h-[52px] mx-auto rounded-full bg-[#fef3f2] border border-[#f3c4bf] text-[#b42318] flex items-center justify-center text-xl font-bold">
        !
      </div>
      <div className="font-heading font-semibold text-[17px] mt-4">That payment was declined</div>
      <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
        {payment.failureReason ?? "Your bank or card issuer declined this payment."} No account has been created and no
        money has left your account.
      </p>
      <div className="text-[11px] text-neutral-500 mt-3 tabular-nums">
        Reference {reference}
        {payment.failedAt &&
          ` · attempted ${new Date(payment.failedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${new Date(
            payment.failedAt
          ).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} WAT`}
      </div>
      {payment.programme?.code && (
        <Link href={`/checkout/${payment.programme.code}`} className={buttonClassName("primary", "mt-5")}>
          Try again
        </Link>
      )}
    </div>
  );
}
