"use client";

import * as React from "react";
import Link from "next/link";
import { pollExamPaymentStatus } from "@/app/actions/exam-sitting";
import { buttonClassName } from "@/components/ui/button";

type PaymentStatusResult = Awaited<ReturnType<typeof pollExamPaymentStatus>>;

const POLL_INTERVAL_MS = 1500;

export function ExamCheckoutStatus({ reference, initial }: { reference: string; initial: PaymentStatusResult }) {
  const [payment, setPayment] = React.useState(initial);

  React.useEffect(() => {
    if (!payment || payment.status !== "PENDING") return;
    const id = setInterval(async () => {
      const next = await pollExamPaymentStatus(reference);
      setPayment(next);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [payment, reference]);

  if (!payment) {
    return (
      <div className="text-center py-8">
        <div className="font-heading font-semibold text-[15px]">We could not find that payment</div>
        <p className="text-neutral-600 text-[12.5px] mt-2">The reference may be out of date. Nothing has gone wrong with your account.</p>
        <Link href="/portal/exams" className={buttonClassName("primary", "mt-4")}>
          Back to examinations
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

  const programmeCode = payment.examRegistration?.exam.programme.code;

  if (payment.status === "SUCCESS") {
    return (
      <div className="text-center py-8">
        <div className="w-[52px] h-[52px] mx-auto rounded-full bg-[#e7f6ed] border border-[#bfe3cd] text-[#15803d] flex items-center justify-center text-xl font-bold">
          ✓
        </div>
        <div className="font-heading font-semibold text-[17px] mt-4">You&apos;re registered</div>
        <p className="text-neutral-600 text-[13px] mt-2 max-w-[42ch] mx-auto">
          {payment.examRegistration?.exam.programme.title
            ? `Your payment for the ${payment.examRegistration.exam.programme.title} examination has been confirmed.`
            : "Your payment has been confirmed."}{" "}
          The paper becomes available exactly at your window's opening time.
        </p>
        <Link href={programmeCode ? `/portal/exams/${programmeCode}` : "/portal/exams"} className={buttonClassName("primary", "mt-5")}>
          View your registration
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
        {payment.failureReason ?? "Your bank declined this payment."} No money has left your account. Support can retry the charge or take a transfer.
      </p>
      <div className="text-[11px] text-neutral-500 mt-3 tabular-nums">
        Reference {reference}
        {payment.failedAt &&
          ` · attempted ${new Date(payment.failedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${new Date(
            payment.failedAt
          ).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} WAT`}
      </div>
      <Link href="/portal/support" className={buttonClassName("primary", "mt-5")}>
        Contact support
      </Link>
    </div>
  );
}
