"use client";

import * as React from "react";
import Link from "next/link";
import { pollPaymentStatus } from "@/app/actions/payment";
import { buttonClassName } from "@/components/ui/button";
import { DownloadButton, ViewOnlineButton } from "@/components/portal/document-file-buttons";

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

  // Document Library (Phase 2) — a document purchase has no enrolment to
  // report on, so it branches here rather than falling into the
  // enrolment-shaped copy below. See getPaymentStatus's comment for why
  // this shared page, not a dedicated route, is what Nomba actually
  // redirects a document purchase back to.
  if (payment.purpose === "DOCUMENT_PURCHASE") {
    const documentTemplateId = payment.documentPurchase?.documentTemplateId;
    const documentTitle = payment.documentPurchase?.documentTemplate.title;

    if (payment.status === "SUCCESS") {
      return (
        <div className="text-center py-8">
          <div className="w-[52px] h-[52px] mx-auto rounded-full bg-[#e7f6ed] border border-[#bfe3cd] text-[#15803d] flex items-center justify-center text-xl font-bold">
            ✓
          </div>
          <div className="font-heading font-semibold text-[17px] mt-4">Template purchased successfully!</div>
          <p className="text-neutral-600 text-[13px] mt-2 max-w-[42ch] mx-auto">
            {documentTitle ? `Your purchase of "${documentTitle}" is confirmed. It's now in My Purchases.` : "Your purchase has been confirmed."}
          </p>
          {documentTemplateId && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <DownloadButton documentTemplateId={documentTemplateId} variant="primary" />
              <ViewOnlineButton documentTemplateId={documentTemplateId} variant="secondary" />
            </div>
          )}
          <div className="mt-4">
            <Link href="/portal/library/purchases" className="text-accent text-[12.5px]">
              Go to My Purchases
            </Link>
          </div>
        </div>
      );
    }

    // FAILED
    return (
      <div className="text-center py-8">
        <div className="w-[52px] h-[52px] mx-auto rounded-full bg-[#fef3f2] border border-[#f3c4bf] text-[#b42318] flex items-center justify-center text-xl font-bold">
          !
        </div>
        <div className="font-heading font-semibold text-[17px] mt-4">Payment failed. Please try again.</div>
        <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
          {payment.failureReason ?? "Your bank or card issuer declined this payment."} No money has left your account, and the template remains
          unpurchased.
        </p>
        {documentTemplateId && (
          <Link href={`/portal/library/templates/${documentTemplateId}`} className={buttonClassName("primary", "mt-5")}>
            Try again
          </Link>
        )}
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
        <Link
          href={payment.enrolment?.programme.code ? `/portal/programme?programme=${payment.enrolment.programme.code}` : "/portal/dashboard"}
          className={buttonClassName("primary", "mt-5")}
        >
          Go to your programme
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
