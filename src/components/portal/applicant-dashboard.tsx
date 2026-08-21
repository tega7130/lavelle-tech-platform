"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { updateProfile, resendVerification } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import type { CurrentCandidate } from "@/lib/candidate-session";
import { Button, buttonClassName } from "@/components/ui/button";

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

const STATUSES: { id: string; value: string; label: string; meta: string }[] = [
  { id: "practising", value: "PRACTISING_LAWYER", label: "Practising Lawyer", meta: "In private practice or at a firm, called to the Nigerian Bar" },
  { id: "inhouse", value: "INHOUSE_COUNSEL", label: "In-house Counsel", meta: "Legal function within a company or public body" },
  { id: "graduate", value: "LAW_GRADUATE", label: "Law Graduate", meta: "LL.B awarded; awaiting or completing Law School" },
  { id: "student", value: "LAW_STUDENT", label: "Law Student", meta: "Currently reading law at an accredited faculty" },
  { id: "regulated", value: "REGULATED_NON_LAWYER", label: "Non-lawyer in a regulated industry", meta: "Compliance, banking, energy, insurance or similar" },
  { id: "other", value: "OTHER", label: "Other", meta: "Tell us in your own words on the next step" },
];

const BANDS: { id: string; value: string; label: string }[] = [
  { id: "0_2", value: "Y0_2", label: "0–2" },
  { id: "3_5", value: "Y3_5", label: "3–5" },
  { id: "6_10", value: "Y6_10", label: "6–10" },
  { id: "10_plus", value: "Y10_PLUS", label: "10+" },
];

function step2Copy(statusId: string) {
  if (statusId === "practising" || statusId === "inhouse") {
    return {
      heading: "Your call to the Bar",
      sub: "These details are verified against the roll before a certificate is issued.",
      f1Label: "Year of call to the Bar",
      f1Hint: "2016",
      f1Key: "yearOfCall" as const,
      f2Label: "Supreme Court Number (SCN)",
      f2Hint: "SCN123456",
      f2Note: "As it appears on your call-to-bar certificate.",
      f2Key: "scnNumber" as const,
    };
  }
  if (statusId === "graduate" || statusId === "student") {
    return {
      heading: "Your institution",
      sub: "We record where you are reading law so your cohort is set correctly.",
      f1Label: "Institution",
      f1Hint: "University of Lagos",
      f1Key: "institution" as const,
      f2Label: "Year of graduation (expected)",
      f2Hint: "2027",
      f2Note: "An estimate is fine; you can update it later.",
      f2Key: "graduationYear" as const,
    };
  }
  if (statusId === "other") {
    return {
      heading: "Tell us more",
      sub: "Describe your professional status in your own words.",
      f1Label: "Your professional status",
      f1Hint: "e.g. Retired judge, career break, industry consultant",
      f1Key: "roleTitle" as const,
      f2Label: null,
      f2Hint: null,
      f2Note: null,
      f2Key: null,
    };
  }
  return {
    heading: "Your role",
    sub: "We record your role so programme recommendations stay relevant.",
    f1Label: "Organisation",
    f1Hint: "Sterling Bank Plc",
    f1Key: "organisation" as const,
    f2Label: "Role or title",
    f2Hint: "Compliance Manager",
    f2Note: "Used only on your internal candidate record.",
    f2Key: "roleTitle" as const,
  };
}

const DISMISSED_KEY = "lavelle_onb_dismissed_v1";

type ModalStage = "welcome" | "form" | "done" | "closed";

export function ApplicantDashboard({ candidate }: { candidate: CurrentCandidate }) {
  const { checklist } = candidate;
  const firstName = candidate.firstName;
  const searchParams = useSearchParams();

  const [stage, setStage] = React.useState<ModalStage>("closed");
  const [showNudge, setShowNudge] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [statusId, setStatusId] = React.useState<string | null>(null);
  const [f1, setF1] = React.useState("");
  const [f2, setF2] = React.useState("");
  const [band, setBand] = React.useState<string | null>(null);
  const [place, setPlace] = React.useState("");
  const [saving, setSaving] = React.useState(false);
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
      setStep(1);
      setStage("form");
      return;
    }
    if (checklist.allDone) return;
    const dismissed = typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dismissed) setStage("welcome");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissForNow() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setStage("closed");
    setShowNudge(true);
  }

  function openModal() {
    setStep(1);
    setStage("form");
  }

  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function saveStep3() {
    setSaving(true);
    setSaveError(null);
    const fd = new FormData();
    if (statusId) fd.set("professionalStatus", STATUSES.find((s) => s.id === statusId)!.value);
    const copy = step2Copy(statusId ?? "other");
    if (f1) fd.set(copy.f1Key, f1);
    if (f2 && copy.f2Key) fd.set(copy.f2Key, f2);
    if (band) fd.set("experienceBand", BANDS.find((b) => b.id === band)!.value);
    if (place) fd.set("placeOfPractice", place);
    fd.set("complete", "true");
    const result = await updateProfile(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message ?? Object.values(result.errors ?? {})[0] ?? "Could not save your profile.");
      return;
    }
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setStage("done");
  }

  async function handleResend() {
    setResendMessage("Sending…");
    const res = await resendVerification();
    setResendMessage(res.ok ? "Verification email sent." : (res.message ?? "Could not resend right now."));
  }

  const professionalDone = checklist.professional || stage === "done";
  const finalDoneCount =
    (checklist.account ? 1 : 0) +
    (professionalDone ? 1 : 0) +
    (checklist.photo ? 1 : 0) +
    (checklist.email ? 1 : 0) +
    (checklist.handbook ? 1 : 0);
  const allDone = finalDoneCount === 5;
  const pct = Math.round((finalDoneCount / 5) * 100);

  const CHECKLIST_ITEMS = [
    { key: "account", label: "Account created", meta: "Name, email and password", done: true, action: null },
    {
      key: "professional",
      label: "Professional details",
      meta: "Tell us about your background",
      done: professionalDone,
      action: professionalDone ? null : { label: "Start", onClick: openModal, href: undefined },
    },
    {
      key: "photo",
      label: "Profile photo",
      meta: "Used to generate your Candidate ID card",
      done: checklist.photo,
      action: checklist.photo ? null : { label: "Upload", href: "/portal/profile", onClick: undefined },
    },
    {
      key: "email",
      label: "Email verification",
      meta: "Confirm your email address",
      done: checklist.email,
      action: checklist.email ? null : { label: "Resend", onClick: handleResend, href: undefined },
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
              openModal();
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
            <div className="text-xs text-neutral-600">{finalDoneCount} of 5 complete</div>
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
          {resendMessage && <div className="mt-3 text-xs text-neutral-600">{resendMessage}</div>}
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

      {stage !== "closed" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-auto bg-[rgba(19,26,46,.45)] p-6">
          <div className="relative max-h-[calc(100vh-80px)] w-full max-w-[452px] overflow-auto rounded-[14px] bg-bg shadow-lg">
            <button
              onClick={dismissForNow}
              aria-label="Close — you can finish this later"
              title="Close — you can finish this later"
              className="absolute top-3 right-3 z-[2] flex h-7 w-7 items-center justify-center rounded-[7px] border border-divider bg-bg text-[15px] leading-none text-neutral-600"
            >
              ×
            </button>

            {stage === "welcome" && (
              <div className="p-[30px] pb-[26px] text-center">
                <div className="font-heading text-lg font-semibold text-accent">Hello {firstName},</div>
                <h2 className="mx-auto mt-1.5 max-w-[24ch] text-xl leading-[1.35] text-balance">
                  We&rsquo;d love to know a little more about you
                </h2>
                <p className="mx-auto mt-[11px] max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
                  Your professional background helps us recommend the right programmes and tier, and ensures your
                  certificates and Candidate ID reflect your standing accurately.
                </p>
                <div className="mt-2.5 text-[11.5px] text-neutral-500">Five short questions — about a minute</div>
                <div className="mt-6 flex gap-2.5">
                  <Button onClick={openModal} className="h-11 flex-1 px-3.5 text-[13.5px] whitespace-nowrap">
                    Tell us about yourself →
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={dismissForNow}
                    className="h-11 flex-1 px-3.5 text-[13.5px] whitespace-nowrap"
                  >
                    I&rsquo;ll come back to this
                  </Button>
                </div>
              </div>
            )}

            {stage === "form" && (
              <>
                <div className="border-b border-dashed border-neutral-300 pl-[30px] pr-12 pt-[18px] pb-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[9.5px] tracking-[0.14em] text-accent-700 uppercase">Step {step} of 3</div>
                    <div className="text-[11px] text-neutral-600">
                      {{ 1: "Professional status", 2: "Professional details", 3: "Experience" }[step]}
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-[5px] flex-1 rounded-full transition-colors duration-300"
                        style={{ background: n <= step ? "var(--color-accent)" : "var(--color-neutral-200)" }}
                      />
                    ))}
                  </div>
                </div>

                <div className="px-[30px] pt-5 pb-1">
                  {step === 1 && (
                    <>
                      <h3 className="m-0 text-[17px]">What is your professional status?</h3>
                      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-neutral-600">
                        Choose the option that best describes you today.
                      </p>
                      <div className="mt-3.5 flex flex-col gap-1.5">
                        {STATUSES.map((o) => (
                          <label
                            key={o.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-[9px] border-[1.5px] px-3 py-2.5 hover:border-accent-400 hover:bg-accent-100"
                            style={{
                              borderColor: statusId === o.id ? "var(--color-accent)" : "var(--color-neutral-300)",
                              background: statusId === o.id ? "var(--color-accent-100)" : "var(--color-bg)",
                            }}
                          >
                            <input
                              type="radio"
                              name="lv-status"
                              checked={statusId === o.id}
                              onChange={() => {
                                setStatusId(o.id);
                                setF1("");
                                setF2("");
                              }}
                              className="h-[15px] w-[15px] flex-none accent-accent"
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] leading-[1.35] font-medium">{o.label}</div>
                              <div className="text-[11px] leading-[1.4] text-neutral-600">{o.meta}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {step === 2 &&
                    (() => {
                      const copy = step2Copy(statusId ?? "other");
                      return (
                        <>
                          <div className="inline-block rounded-full bg-accent-100 px-[11px] py-1 text-[11px] font-medium text-accent-700">
                            {STATUSES.find((s) => s.id === statusId)?.label ?? "Other"}
                          </div>
                          <h3 className="mt-2.5 mb-0 text-[17px]">{copy.heading}</h3>
                          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-neutral-600 text-pretty">
                            {copy.sub}
                          </p>
                          <div className="mt-4 flex flex-col gap-3.5">
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                                {copy.f1Label}
                              </label>
                              <input
                                placeholder={copy.f1Hint}
                                value={f1}
                                onChange={(e) => setF1(e.target.value)}
                                className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm"
                              />
                            </div>
                            {copy.f2Key && (
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                                  {copy.f2Label}
                                </label>
                                <input
                                  placeholder={copy.f2Hint ?? undefined}
                                  value={f2}
                                  onChange={(e) => setF2(e.target.value)}
                                  className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm"
                                />
                                <div className="mt-1.5 text-[11.5px] text-neutral-600">{copy.f2Note}</div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}

                  {step === 3 && (
                    <>
                      <h3 className="m-0 text-[17px]">Experience and place of practice</h3>
                      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-neutral-600">
                        Used to group you with an appropriate cohort.
                      </p>
                      <div className="mt-4 flex flex-col gap-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                            Years of experience
                          </label>
                          <div className="flex gap-1.5 rounded-[10px] border border-neutral-300 bg-bg p-1">
                            {BANDS.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setBand(b.id)}
                                className="h-[38px] flex-1 rounded-[7px] text-[13px] font-medium"
                                style={{
                                  background: band === b.id ? "var(--color-accent-100)" : "transparent",
                                  color: band === b.id ? "var(--color-accent)" : "var(--color-neutral-700)",
                                }}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                            State or country of practice
                          </label>
                          <input
                            placeholder="Lagos State, Nigeria"
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="px-[30px] pt-[18px] pb-[22px]">
                  {saveError && (
                    <div className="mb-3 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3 py-2 text-[12.5px] text-[#912019]">
                      {saveError}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {step > 1 && (
                      <button
                        onClick={() => setStep((s) => Math.max(1, s - 1))}
                        className="border-0 bg-transparent px-0.5 py-2 text-[13px] font-medium text-neutral-700"
                      >
                        ← Back
                      </button>
                    )}
                    <button onClick={dismissForNow} className="text-xs text-neutral-600">
                      Skip for now
                    </button>
                    <div className="flex-1" />
                    <Button
                      onClick={() => (step === 3 ? saveStep3() : setStep((s) => s + 1))}
                      disabled={saving || (step === 1 && !statusId)}
                      className="h-[42px] text-[13.5px]"
                    >
                      {saving ? "Saving…" : step === 3 ? "Save profile" : "Next →"}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {stage === "done" && (
              <div className="p-9 px-[30px] pb-[30px] text-center">
                <div className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border-[1.5px] border-accent-2-300 bg-accent-2-100">
                  <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
                    <circle cx="15" cy="15" r="11" fill="#ffc629" />
                    <path d="M10 15.4l3.3 3.3L20.2 11.8" stroke="#08234a" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="mt-4 text-xl">Profile updated</h2>
                <p className="mx-auto mt-2.5 max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
                  Thank you, {firstName}. Your professional details are on record and your programme recommendations
                  now reflect your standing.
                </p>
                <div className="mt-[22px] flex flex-col items-center gap-2.5">
                  <Link href="/portal/catalogue" className={buttonClassName("primary", "h-11 px-5")}>
                    Browse programmes →
                  </Link>
                  <button onClick={() => setStage("closed")} className="text-xs text-neutral-600">
                    Go to dashboard instead
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
