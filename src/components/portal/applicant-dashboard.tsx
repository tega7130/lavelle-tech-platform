"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resendVerification } from "@/app/actions/candidate-auth";
import type { CurrentCandidate } from "@/lib/candidate-session";
import { buttonClassName } from "@/components/ui/button";
import { ProfileCompletionModal, type ProfileModalTrigger } from "@/components/portal/profile-completion-modal";

const REGISTRATION_STEPS = [
  { label: "Registration completed", meta: "Provisional applicant number issued", done: true },
  { label: "Profile details confirmed", meta: "Name, email and phone on file", done: true },
  { label: "Choose a programme", meta: "Browse the catalogue by specialization and level", done: false, n: "3" },
  { label: "Complete payment", meta: "Candidate ID, ID card and programme access follow", done: false, n: "4" },
];

const BENEFITS = [
  "A permanent Candidate ID and formal Candidate ID card",
  "Access to your programme's four modules and twenty lectures",
  "Faculty-marked drafting exercises and module quizzes",
  "A verifiable certificate on completion of the tier",
];

const DISMISSED_KEY = "lavelle_onb_dismissed_v1";

export function ApplicantDashboard({ candidate }: { candidate: CurrentCandidate }) {
  const { checklist } = candidate;
  const firstName = candidate.firstName;
  const searchParams = useSearchParams();

  const [trigger, setTrigger] = React.useState<ProfileModalTrigger>("closed");
  const [justCompleted, setJustCompleted] = React.useState(false);
  const [showNudge, setShowNudge] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    // A genuine one-time read from an external system (localStorage isn't
    // available during render/SSR, so this can't be computed during
    // render like the error-state syncing elsewhere in this file) —
    // exactly what effects are for, per react.dev/learn/synchronizing-with-effects.
    // The Profile & ID page's "Edit"/"Add details" link lands here with
    // ?complete=professional — that takes priority over the localStorage
    // dismissal, since the candidate just asked to edit this specific step.
    if (searchParams.get("complete") === "professional") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrigger("form");
      return;
    }
    if (checklist.allDone) return;
    const dismissed = typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dismissed) setTrigger("welcome");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModalClose() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setTrigger("closed");
    setShowNudge(true);
  }

  function handleModalSaved() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setJustCompleted(true);
  }

  async function handleResend() {
    setResendMessage("Sending…");
    const res = await resendVerification();
    setResendMessage(res.ok ? "Verification email sent." : (res.message ?? "Could not resend right now."));
  }

  const professionalDone = checklist.professional || justCompleted;
  // Email verification happens during registration itself now (an OTP step
  // before the account exists), so it's not a checklist item any more —
  // checklist.email is still read below, just to drive a standalone banner
  // for the pre-OTP accounts that predate this and never verified.
  const finalDoneCount =
    (checklist.account ? 1 : 0) +
    (professionalDone ? 1 : 0) +
    (checklist.photo ? 1 : 0) +
    (checklist.handbook ? 1 : 0);
  const allDone = finalDoneCount === 4;
  const pct = Math.round((finalDoneCount / 4) * 100);

  const CHECKLIST_ITEMS = [
    { key: "account", label: "Account created", meta: "Name, email and password", done: true, action: null },
    {
      key: "professional",
      label: "Professional details",
      meta: "Tell us about your background",
      done: professionalDone,
      action: professionalDone ? null : { label: "Start", onClick: () => setTrigger("form"), href: undefined },
    },
    {
      key: "photo",
      label: "Profile photo",
      meta: "Used to generate your Candidate ID card",
      done: checklist.photo,
      action: checklist.photo ? null : { label: "Upload", href: "/portal/profile", onClick: undefined },
    },
    {
      key: "handbook",
      label: "Candidate handbook",
      meta: "Acknowledge the candidate handbook",
      done: checklist.handbook,
      action: checklist.handbook ? null : { label: "Read", href: "/portal/profile", onClick: undefined },
    },
  ];

  return (
    <div className="flex max-w-[980px] flex-col gap-6">
      <div className="rounded-md border border-divider bg-bg p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
                Registration complete
              </div>
              {allDone && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-2-300 bg-accent-2-100 px-2.5 py-[3px] text-[11px] font-medium text-accent-2-800">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-2 text-[9px] font-bold text-[#08234a]">
                    ✓
                  </span>
                  Profile complete
                </span>
              )}
            </div>
            <h1 className="mt-1 mb-0">{candidate.firstName} {candidate.lastName}</h1>
            <p className="mt-2 max-w-[56ch] text-sm text-neutral-600 text-pretty">
              Your registration is on file. Choose a programme and complete payment to begin — your place is held
              until the acceptance window closes.
            </p>
          </div>
          <div className="flex-none rounded-md border border-accent-200 bg-accent-100 p-4 text-right">
            <div className="text-[10px] tracking-[0.08em] text-accent-700 uppercase">Provisional applicant no.</div>
            <div className="mt-1 font-mono text-base text-accent-700">{candidate.applicantNumber}</div>
            <div className="mt-1 text-[11px] text-neutral-600">Quote this when contacting us</div>
          </div>
        </div>
        <div className="hr" />
        <div className="flex gap-3">
          <Link href="/portal/catalogue" className={buttonClassName("primary")}>
            Browse programmes
          </Link>
          <Link href="/portal/support" className={buttonClassName("secondary")}>
            Speak to a representative
          </Link>
        </div>
      </div>

      {/* Accounts registered before the OTP flow may still be unverified.
          Not part of the checklist above (email is proven at registration
          now) and not gated on allDone — an otherwise-complete old account
          shouldn't lose its only path to resend. */}
      {!checklist.email && (
        <div className="flex items-center gap-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-heading text-[13.5px] font-semibold text-[#912019]">Your email isn&rsquo;t verified</div>
            <div className="text-[12.5px] text-[#912019]/80 text-pretty">
              {resendMessage ?? "Confirm your address so we can reach you about your application."}
            </div>
          </div>
          <button
            onClick={handleResend}
            className="flex-none font-heading text-[13px] font-semibold text-[#912019]"
          >
            Resend →
          </button>
        </div>
      )}

      {showNudge && !allDone && (
        <div className="flex items-center gap-4 rounded-md border border-accent-200 bg-accent-100 px-4 py-3">
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-accent-200 bg-bg">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--color-accent)" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="10" cy="6.6" r="3.1" />
              <path d="M4 16.4c.7-2.7 3-4.3 6-4.3s5.3 1.6 6 4.3" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-[13.5px] font-semibold">Complete your professional profile</div>
            <div className="text-[12.5px] text-neutral-600 text-pretty">
              Your background determines how your credentials are recorded and issued.
            </div>
          </div>
          <button
            onClick={() => {
              setShowNudge(false);
              setTrigger("form");
            }}
            className="flex-none font-heading text-[13px] font-semibold text-text"
          >
            Do it now →
          </button>
          <button
            onClick={() => setShowNudge(false)}
            aria-label="Dismiss"
            className="flex-none cursor-pointer border-0 bg-transparent p-1 text-[15px] leading-none text-neutral-500"
          >
            ×
          </button>
        </div>
      )}

      {!showNudge && !allDone && (
        <div className="rounded-md border border-divider bg-bg p-5 px-6">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="m-0">Complete your profile</h3>
            <div className="text-xs text-neutral-600">{finalDoneCount} of 4 complete</div>
          </div>
          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 border-t border-dashed border-neutral-300">
            {CHECKLIST_ITEMS.map((it) => (
              <div key={it.key} className="flex items-start gap-3 border-b border-dashed border-neutral-300 py-3">
                <span
                  className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px] text-[11px] font-bold text-bg"
                  style={{
                    background: it.done ? "var(--color-accent)" : "transparent",
                    borderColor: it.done ? "var(--color-accent)" : "var(--color-neutral-400)",
                  }}
                >
                  {it.done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13.5px] font-medium"
                    style={{ color: it.done ? "var(--color-neutral-600)" : "var(--color-text)" }}
                  >
                    {it.label}
                  </div>
                  <div className="text-xs leading-[1.5] text-neutral-600">{it.meta}</div>
                </div>
                {it.action?.href && (
                  <Link href={it.action.href} className="mt-px flex-none text-xs font-medium text-accent">
                    {it.action.label}
                  </Link>
                )}
                {it.action?.onClick && (
                  <button
                    onClick={it.action.onClick}
                    className="mt-px flex-none text-xs font-medium text-accent"
                  >
                    {it.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11.5px] text-neutral-600">
            A complete profile is required before a Candidate ID card can be issued.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
        <div>
          <h3>Your registration</h3>
          <div className="overflow-hidden rounded-md border border-divider">
            {REGISTRATION_STEPS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 border-b border-dashed border-neutral-300 p-4 last:border-b-0">
                <span
                  className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] text-[11px]"
                  style={{
                    borderColor: s.done ? "var(--color-accent)" : "var(--color-neutral-400)",
                    background: s.done ? "var(--color-accent)" : "transparent",
                    color: s.done ? "#ffffff" : "var(--color-neutral-500)",
                  }}
                >
                  {s.done ? "✓" : s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px]">{s.label}</div>
                  <div className="text-[11.5px] text-neutral-600">{s.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-fit rounded-md border border-divider bg-bg p-4">
          <div className="text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
            What you get on enrolment
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {BENEFITS.map((b) => (
              <div key={b} className="flex gap-2.5 text-[13px] leading-[1.5] text-neutral-700">
                <span className="flex-none text-accent">—</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ProfileCompletionModal
        firstName={firstName}
        trigger={trigger}
        onClose={handleModalClose}
        onSaved={handleModalSaved}
      />
    </div>
  );
}
