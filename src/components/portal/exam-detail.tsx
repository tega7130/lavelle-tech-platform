"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
import { formatNaira, tierLabel } from "@/lib/format";
import { registerForExamAction, startSittingAction } from "@/app/actions/exam-sitting";
import type { getExamDetail } from "@/lib/exam-candidate-reads";

type Detail = Awaited<ReturnType<typeof getExamDetail>>;

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function ExamDetail({ detail, programmeCode }: { detail: Detail; programmeCode: string }) {
  const [stage, setStage] = React.useState<"browse" | "confirm">("browse");
  const [windowId, setWindowId] = React.useState<string | null>(detail.windows[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedWindow = detail.windows.find((w) => w.id === windowId) ?? null;
  const eligible = detail.eligibility.eligible;

  async function pay() {
    if (!windowId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await registerForExamAction(detail.exam.id, windowId);
      window.location.href = result.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start registration.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[880px] flex flex-col gap-[var(--space-5)]">
      <div>
        <Link href="/portal/exams" className="text-accent text-[12.5px] font-medium">
          ← All examinations
        </Link>
        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Tag variant="accent">{tierLabel(detail.programme.tier)}</Tag>
              <Tag variant="neutral">{detail.programme.categoryName}</Tag>
            </div>
            <h1 className="font-heading text-2xl mt-2 mb-0">{detail.programme.title} — Examination</h1>
            <div className="text-neutral-500 text-[12.5px] mt-1">{detail.programme.code}</div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500 text-[10.5px] tracking-[0.1em] uppercase">Exam fee</div>
            <div className="font-heading font-bold text-xl">{formatNaira(detail.exam.feeMinor)}</div>
          </div>
        </div>
      </div>

      <Card elev="sm">
        <p className="text-[13.5px] text-neutral-700 leading-relaxed m-0">{detail.programme.summary}</p>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Duration</div>
            <div className="text-[13px] font-medium mt-0.5">{detail.exam.durationMinutes / 60} hours</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Pass mark</div>
            <div className="text-[13px] font-medium mt-0.5">{detail.exam.passMarkPercent}%</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Attempts</div>
            <div className="text-[13px] font-medium mt-0.5">
              {detail.exam.attemptPolicy === "ONE_ATTEMPT" ? "One" : detail.exam.attemptPolicy === "TWO_ATTEMPTS" ? "Two" : "One, plus a resit on referral"}
            </div>
          </div>
        </div>
      </Card>

      {detail.eligibility.prerequisiteRequired && (
        <div
          className="flex items-start gap-3 px-5 py-4 rounded-md border"
          style={{ background: eligible ? "var(--color-accent-2-100)" : "#fff7e6", borderColor: eligible ? "var(--color-accent-2-300)" : "#f0d9a8" }}
        >
          <span
            className="w-[26px] h-[26px] flex-none rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: eligible ? "var(--color-accent-2)" : "#fdf0d2", color: eligible ? "var(--color-accent-2-900)" : "#a16207" }}
          >
            {eligible ? "✓" : "!"}
          </span>
          <div>
            <div className="font-heading font-semibold text-[13.5px]">{eligible ? "Prerequisite met" : "Prerequisite not yet met"}</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: eligible ? "var(--color-accent-2-800)" : "#8a6013" }}>
              {eligible
                ? `Certified via your completed enrolment in ${detail.eligibility.prerequisiteProgrammeTitle}.`
                : "Advanced Practitioner requires a completed Specialist-tier enrolment in the same specialization before you can sit this examination."}
            </div>
          </div>
        </div>
      )}

      {detail.existingRegistration ? (
        <ExistingRegistration reg={detail.existingRegistration} programmeCode={programmeCode} />
      ) : stage === "browse" ? (
        <Card elev="sm">
          <CardKicker>Choose a window</CardKicker>
          {detail.windows.length === 0 ? (
            <p className="text-neutral-600 text-[13px] mt-3">No windows are currently scheduled for this examination.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {detail.windows.map((w) => {
                const closed = new Date() > new Date(w.registrationDeadline);
                return (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer"
                    style={{
                      borderColor: windowId === w.id ? "var(--color-accent)" : "var(--color-neutral-300)",
                      background: windowId === w.id ? "var(--color-accent-100)" : "transparent",
                      opacity: closed ? 0.5 : 1,
                    }}
                  >
                    <input type="radio" name="window" disabled={closed} checked={windowId === w.id} onChange={() => setWindowId(w.id)} className="w-4 h-4 accent-accent" />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{formatDate(w.opensAt)}</div>
                      <div className="text-neutral-500 text-[11.5px] mt-0.5">
                        Register by {formatDate(w.registrationDeadline)}
                        {closed ? " — registration closed" : ""}
                        {w.capacity != null ? ` · capacity ${w.capacity}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <Button className="mt-4" disabled={!eligible || !windowId} onClick={() => setStage("confirm")}>
            Continue to payment
          </Button>
          {!eligible && <p className="text-neutral-500 text-[12px] mt-2">Registration opens once the prerequisite above is met.</p>}
        </Card>
      ) : (
        selectedWindow && (
          <Card elev="sm" className="border-accent-300">
            <CardKicker>Confirm and pay</CardKicker>
            <div className="mt-3 p-4 rounded-md bg-neutral-100 border border-dashed border-neutral-300">
              <div className="flex justify-between text-[13px]">
                <span className="text-neutral-600">Examination window</span>
                <span className="font-medium">{formatDate(selectedWindow.opensAt)}</span>
              </div>
              <div className="flex justify-between text-[13px] mt-2">
                <span className="text-neutral-600">Exam fee</span>
                <span className="font-medium">{formatNaira(detail.exam.feeMinor)}</span>
              </div>
            </div>
            <p className="text-neutral-500 text-[12px] mt-3">
              Once paid, your window cannot be changed by cancelling and re-registering — contact support if your circumstances change.
            </p>
            {error && <div className="text-[#b42318] text-[12.5px] mt-2">{error}</div>}
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setStage("browse")} disabled={busy}>
                Back
              </Button>
              <Button onClick={pay} disabled={busy}>
                {busy ? "Starting checkout…" : `Pay ${formatNaira(detail.exam.feeMinor)}`}
              </Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}

function ExistingRegistration({ reg, programmeCode }: { reg: NonNullable<Detail["existingRegistration"]>; programmeCode: string }) {
  if (reg.paymentStatus === "PENDING") {
    return (
      <Card elev="sm">
        <CardKicker>Payment pending</CardKicker>
        <p className="text-neutral-600 text-[13px] mt-2">
          Your registration for {formatDate(reg.windowOpensAt)} is awaiting payment confirmation. This updates automatically once confirmed.
        </p>
      </Card>
    );
  }
  if (reg.paymentStatus === "FAILED") {
    return (
      <Card elev="sm">
        <CardKicker>Payment declined</CardKicker>
        <p className="text-neutral-600 text-[13px] mt-2">
          Your payment for the {formatDate(reg.windowOpensAt)} window was declined. Contact support to retry or arrange an offline payment.
        </p>
        <Link href="/portal/support" className={buttonClassName("secondary", "mt-3")}>
          Contact support
        </Link>
      </Card>
    );
  }

  // Payment confirmed.
  if (!reg.sittingState) {
    return <UnstartedRegistration reg={reg} />;
  }

  if (reg.sittingState === "REGISTERED" || reg.sittingState === "IN_PROGRESS") {
    return (
      <Card elev="sm" className="border-accent-300">
        <CardKicker>Your sitting</CardKicker>
        <p className="text-neutral-600 text-[13px] mt-2">
          {reg.sittingState === "IN_PROGRESS" ? "Your sitting is in progress." : "Your sitting window is open."}
        </p>
        <Link href={`/sitting/${reg.sittingId}`} className={buttonClassName("primary", "mt-3")}>
          {reg.sittingState === "IN_PROGRESS" ? "Return to your sitting" : "Start your sitting"}
        </Link>
      </Card>
    );
  }

  if (reg.sittingState === "RELEASED") {
    return (
      <Card elev="sm">
        <CardKicker>Result released</CardKicker>
        <Link href={`/portal/exams/results/${reg.sittingId}`} className={buttonClassName("primary", "mt-3")}>
          View your result
        </Link>
      </Card>
    );
  }

  if (reg.sittingState === "FORFEITED") {
    return (
      <Card elev="sm">
        <CardKicker>Sitting forfeited</CardKicker>
        <p className="text-neutral-600 text-[13px] mt-2">
          You quit this sitting before submitting. Nothing was marked. {programmeCode ? "Contact support about a further attempt." : ""}
        </p>
      </Card>
    );
  }

  return (
    <Card elev="sm">
      <CardKicker>Awaiting your result</CardKicker>
      <p className="text-neutral-600 text-[13px] mt-2">Your paper has been submitted and is being marked. Results are released once every written answer is returned.</p>
    </Card>
  );
}

function UnstartedRegistration({ reg }: { reg: NonNullable<Detail["existingRegistration"]> }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const now = new Date();
  const windowOpen = now >= new Date(reg.windowOpensAt) && now < new Date(reg.windowClosesAt);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const sitting = await startSittingAction(reg.id);
      router.push(`/sitting/${sitting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start your sitting.");
      setBusy(false);
    }
  }

  return (
    <Card elev="sm" className="border-accent-2-300 bg-accent-2-100">
      <div className="flex items-center gap-2.5">
        <span className="w-[26px] h-[26px] flex-none rounded-full bg-accent-2 text-accent-2-900 flex items-center justify-center text-sm font-bold">✓</span>
        <div className="font-heading font-semibold text-[14px]">Registration confirmed</div>
      </div>
      <p className="text-accent-2-800 text-[12.5px] mt-2">
        {windowOpen
          ? "Your examination window is open. Begin whenever you are ready — the clock starts the moment you do."
          : `You are registered for the examination window opening ${formatDate(reg.windowOpensAt)}. The paper becomes available exactly at the window's opening time.`}
      </p>
      {error && <div className="text-[#b42318] text-[12.5px] mt-2">{error}</div>}
      {windowOpen && (
        <Button className="mt-3" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start your sitting"}
        </Button>
      )}
    </Card>
  );
}
