"use client";

import * as React from "react";
import Link from "next/link";
import { pollPaymentStatus } from "@/app/actions/payment";
import { buttonClassName } from "@/components/ui/button";

type PaymentStatusResult = Awaited<ReturnType<typeof pollPaymentStatus>>;

const POLL_INTERVAL_MS = 1500;

/**
 * Polls getPaymentStatus (via the pollPaymentStatus Server Action) rather
 * than trusting anything already in this page's URL — a candidate who
 * edits the reference or the query string must not appear enrolled
 * (rule 6). The webhook/manual-confirm/offline-recording path is the
 * only thing that can ever move this to SUCCESS.
 */
export function CheckoutStatus({ reference, initial }: { reference: string; initial: PaymentStatusResult }) {
  const [payment, setPayment] = React.useState(initial);

  React.useEffect(() => {
    if (!payment || payment.status !== "PENDING") return;
    const id = setInterval(async () => {
      const next = await pollPaymentStatus(reference);
      setPayment(next);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [payment, reference]);

  if (!payment) {
    return (
      <div className="text-center py-8">
        <div className="font-heading font-semibold text-[15px]">We could not find that payment</div>
        <p className="text-neutral-600 text-[12.5px] mt-2">
          The reference may be out of date. Nothing has gone wrong with your account.
        </p>
        <Link href="/portal/catalogue" className={buttonClassName("primary", "mt-4")}>
          Back to the catalogue
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
        <div className="font-heading font-semibold text-[17px] mt-4">You&apos;re enrolled</div>
        <p className="text-neutral-600 text-[13px] mt-2 max-w-[42ch] mx-auto">
          {payment.enrolment?.programme.title
            ? `Your payment for ${payment.enrolment.programme.title} has been confirmed. Your candidate number and cohort are on your dashboard.`
            : "Your payment has been confirmed."}
        </p>
        <Link href="/portal/dashboard" className={buttonClassName("primary", "mt-5")}>
          Go to your dashboard
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
        {payment.failureReason ?? "Your bank or card issuer declined this payment."} No money has left your account.
      </p>
      <div className="text-[11px] text-neutral-500 mt-3 tabular-nums">
        Reference {reference}
        {payment.failedAt &&
          ` · attempted ${new Date(payment.failedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${new Date(
            payment.failedAt
          ).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} WAT`}
      </div>
      {payment.enrolment?.programme.code && (
        <Link href={`/portal/catalogue/${payment.enrolment.programme.code}`} className={buttonClassName("primary", "mt-5")}>
          Try again
        </Link>
      )}
    </div>
  );
}
