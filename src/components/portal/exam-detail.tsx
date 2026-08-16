"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
import { formatNaira, tierLabel } from "@/lib/format";
import { registerForExamAction, startSittingAction, getAdmissionSlipDownloadUrlAction } from "@/app/actions/exam-sitting";
import type { getExamDetail } from "@/lib/exam-candidate-reads";

type Detail = Awaited<ReturnType<typeof getExamDetail>>;

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
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
        {detail.courseMet && (
          <div className="flex items-start gap-2.5 mt-4 px-4 py-3 rounded-md bg-accent-2-100 border border-accent-2-300">
            <span className="w-[20px] h-[20px] flex-none rounded-full bg-accent-2 text-accent-2-900 flex items-center justify-center text-[11px] font-bold mt-0.5">
              ✓
            </span>
            <div>
              <div className="text-[12.5px] font-medium text-accent-2-800">Course requirement met</div>
              <div className="text-accent-2-800 text-[12px] mt-0.5 leading-relaxed">
                You completed {detail.programme.title}
                {detail.courseCompletedAt ? ` on ${formatDate(detail.courseCompletedAt)}` : ""}.{" "}
                {detail.programme.tier === "ADVANCED_PRACTITIONER"
                  ? "A completed programme is required at Advanced Practitioner level."
                  : "At this tier a completed programme is optional context — it is recorded on your certificate as a Lavelle pathway credential, but is not required to sit this examination."}
              </div>
            </div>
          </div>
        )}
      </div>

      <Card elev="sm">
        <p className="text-[13.5px] text-neutral-700 leading-relaxed m-0">{detail.exam.description || detail.programme.summary}</p>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">{detail.exam.examFormat ? "Format" : "Duration"}</div>
            <div className="text-[13px] font-medium mt-0.5">{detail.exam.examFormat || `${detail.exam.durationMinutes / 60} hours`}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">{detail.exam.examFormat ? "Duration" : "Pass mark"}</div>
            <div className="text-[13px] font-medium mt-0.5">{detail.exam.examFormat ? `${detail.exam.durationMinutes / 60} hours` : `${detail.exam.passMarkPercent}%`}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">{detail.exam.examFormat ? "Pass mark" : "Attempts"}</div>
            <div className="text-[13px] font-medium mt-0.5">
              {detail.exam.examFormat
                ? `${detail.exam.passMarkPercent}%`
                : detail.exam.attemptPolicy === "ONE_ATTEMPT"
                ? "One"
                : detail.exam.attemptPolicy === "TWO_ATTEMPTS"
                ? "Two"
                : "One, plus a resit on referral"}
            </div>
          </div>
        </div>
      </Card>

      {(detail.exam.examinationAreas.length > 0 || detail.exam.onPassing.length > 0) && (
        <Card elev="sm">
          {detail.exam.examinationAreas.length > 0 && (
            <div>
              <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">What is examined</div>
              <ul className="list-disc pl-5 mt-1.5 flex flex-col gap-1 text-[13px]">
                {detail.exam.examinationAreas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {detail.exam.onPassing.length > 0 && (
            <div className={detail.exam.examinationAreas.length > 0 ? "mt-4" : ""}>
              <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">On passing</div>
              <ul className="list-disc pl-5 mt-1.5 flex flex-col gap-1 text-[13px]">
                {detail.exam.onPassing.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card elev="sm">
        <CardKicker>Eligibility</CardKicker>
        {detail.exam.requirements.length === 0 ? (
          <p className="text-[13px] mt-1.5">Open to all candidates — no prerequisites required.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {detail.exam.requirements.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-[13px]">
                <Tag variant={r.isMandatory ? "danger" : "neutral"} className="mt-0.5 flex-none">
                  {r.isMandatory ? "Required" : "Recommended"}
                </Tag>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}
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
        <ExistingRegistration reg={detail.existingRegistration} detail={detail} programmeCode={programmeCode} />
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

function ExistingRegistration({
  reg,
  detail,
  programmeCode,
}: {
  reg: NonNullable<Detail["existingRegistration"]>;
  detail: Detail;
  programmeCode: string;
}) {
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
    return <UnstartedRegistration reg={reg} detail={detail} />;
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

const PREP_GUIDANCE = (exam: Detail["exam"]) => {
  const items = [
    "Read the examination rules in full before you begin, including the attempts policy and pass standard.",
    exam.enforceFullScreen && exam.warnOnTabSwitch
      ? "The paper is full-screen and every tab switch is logged for the invigilator."
      : exam.enforceFullScreen
      ? "The paper runs in full-screen mode for the whole sitting."
      : exam.warnOnTabSwitch
      ? "Switching away from the paper during your sitting is logged for the invigilator."
      : "Keep your attention on the paper for the whole sitting.",
    "Test your connection and camera the day before. A stable line is your responsibility once the timer starts.",
    "Your admission slip is released two weeks ahead of your window and carries your seat reference.",
  ];
  return items.filter((x): x is string => !!x);
};

function UnstartedRegistration({ reg, detail }: { reg: NonNullable<Detail["existingRegistration"]>; detail: Detail }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slipBusy, setSlipBusy] = React.useState(false);
  const [slipError, setSlipError] = React.useState<string | null>(null);
  const now = new Date();
  const windowOpen = now >= new Date(reg.windowOpensAt) && now < new Date(reg.windowClosesAt);
  const daysToGo = Math.max(0, Math.ceil((new Date(reg.windowOpensAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const slipReleaseAt = new Date(new Date(reg.windowOpensAt).getTime() - 14 * 24 * 60 * 60 * 1000);
  const slipReleased = now >= slipReleaseAt;

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

  async function downloadSlip() {
    setSlipBusy(true);
    setSlipError(null);
    try {
      const url = await getAdmissionSlipDownloadUrlAction(reg.id);
      window.open(url, "_blank");
    } catch (e) {
      setSlipError(e instanceof Error ? e.message : "Could not open the admission slip.");
    } finally {
      setSlipBusy(false);
    }
  }

  const milestones = [
    { label: "Registered", done: true, date: reg.registeredAt },
    { label: "Fee paid", done: !!reg.paymentConfirmedAt, date: reg.paymentConfirmedAt },
    { label: "Admission slip", done: slipReleased, date: slipReleased ? slipReleaseAt : null, pendingNote: slipReleased ? null : `Releases ${formatDate(slipReleaseAt)}` },
    { label: "Sitting", done: false, date: reg.windowOpensAt, upcoming: true },
  ];

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <Card elev="md" className="border-accent-2-300 bg-accent-2-100">
        <div className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-accent-2 text-accent-2-900 flex items-center justify-center text-sm font-bold">
            ✓
          </span>
          <Tag variant="success">Registration confirmed</Tag>
        </div>
        <div className="font-heading text-xl mt-3">{detail.programme.title}</div>
        <div className="text-accent-2-800 text-[12.5px] mt-1">
          {detail.programme.code} · {tierLabel(detail.programme.tier)} tier
          {reg.paymentReference ? ` · receipt ${reg.paymentReference}` : ""}
        </div>
      </Card>

      <Card elev="sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardKicker>Your sitting</CardKicker>
            <div className="font-heading font-semibold text-[16px] mt-1">{formatDate(reg.windowOpensAt)}</div>
            <div className="text-neutral-500 text-[12.5px] mt-1">
              Opens {new Date(reg.windowOpensAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} WAT · {detail.exam.durationMinutes / 60} hours ·
              remote, proctored
            </div>
          </div>
          {!windowOpen && (
            <div className="text-center flex-none">
              <div className="font-heading font-bold text-2xl">{daysToGo}</div>
              <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase mt-0.5">Days to go</div>
            </div>
          )}
        </div>
      </Card>

      <Card elev="sm">
        <CardKicker>Status</CardKicker>
        <div className="flex flex-col gap-3 mt-3">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center gap-3">
              <span
                className="w-[22px] h-[22px] flex-none rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: m.done ? "var(--color-accent-2)" : "var(--color-neutral-200)",
                  color: m.done ? "var(--color-accent-2-900)" : "var(--color-neutral-500)",
                }}
              >
                {m.done ? "✓" : i + 1}
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{m.label}</div>
                {m.pendingNote && !m.done ? (
                  <div className="text-neutral-500 text-[11.5px]">{m.pendingNote}</div>
                ) : (
                  <div className="text-neutral-500 text-[11.5px]">{formatDate(m.date)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card elev="sm">
        <CardKicker>Preparing for the sitting</CardKicker>
        <ol className="flex flex-col gap-3 mt-3 pl-0" style={{ listStyle: "none" }}>
          {PREP_GUIDANCE(detail.exam).map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-[20px] h-[20px] flex-none rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-[10.5px] font-medium text-neutral-600">
                {i + 1}
              </span>
              <span className="text-[13px] text-neutral-700 leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </Card>

      {(error || slipError) && <div className="text-[#b42318] text-[12.5px]">{error ?? slipError}</div>}

      <div className="flex gap-2 flex-wrap">
        {windowOpen && (
          <Button onClick={start} disabled={busy}>
            {busy ? "Starting…" : "Go to the examination"}
          </Button>
        )}
        {reg.hasEnrolment && (
          <Link href="/portal/deadlines" className={buttonClassName("secondary")}>
            See it in Deadlines
          </Link>
        )}
        <Button variant="secondary" onClick={downloadSlip} disabled={!slipReleased || slipBusy}>
          {slipBusy ? "Opening…" : slipReleased ? "Download admission slip" : `Admission slip from ${formatDate(slipReleaseAt)}`}
        </Button>
      </div>
    </div>
  );
}
