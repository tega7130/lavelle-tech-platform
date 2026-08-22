"use client";

import * as React from "react";
import Link from "next/link";
import { updateProfile } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { Button, buttonClassName } from "@/components/ui/button";

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
      f2Label: null,
      f2Hint: null,
      f2Note: null,
      f2Key: null,
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

/** What the caller wants shown right now — "closed" hides the modal entirely. */
export type ProfileModalTrigger = "closed" | "welcome" | "form";
type Stage = ProfileModalTrigger | "done";

/**
 * The professional-details wizard, shared by ApplicantDashboard (proactive
 * "welcome" popup + checklist "Start") and EnrolledDashboard's profile
 * checklist card — extracted so a guest-checkout candidate (who lands
 * straight in the enrolled dashboard, never the applicant one) gets the
 * same path to complete their profile instead of it only existing pre-
 * enrolment. `trigger` is write-only from the caller's side: bumping it to
 * "welcome" or "form" (re)opens the modal at that stage; internal
 * progression (form → done) and dismissal are reported back via onClose /
 * onSaved rather than mirrored into the caller's trigger state.
 */
export function ProfileCompletionModal({
  firstName,
  trigger,
  onClose,
  onSaved,
}: {
  firstName: string;
  trigger: ProfileModalTrigger;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = React.useState<Stage>(trigger);
  const [step, setStep] = React.useState(1);
  const [statusId, setStatusId] = React.useState<string | null>(null);
  const [f1, setF1] = React.useState("");
  const [f2, setF2] = React.useState("");
  const [band, setBand] = React.useState<string | null>(null);
  const [place, setPlace] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Re-opening (trigger flips away from "closed") resets the wizard —
  // adjusted during render, not an effect, since this is deriving state
  // from a prop change rather than syncing with something external.
  const [prevTrigger, setPrevTrigger] = React.useState(trigger);
  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    if (trigger !== "closed") {
      setStage(trigger);
      setStep(1);
      setStatusId(null);
      setF1("");
      setF2("");
      setBand(null);
      setPlace("");
      setSaveError(null);
    }
  }

  function openForm() {
    setStep(1);
    setStage("form");
  }

  function close() {
    setStage("closed");
    onClose();
  }

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
    setStage("done");
    onSaved();
  }

  if (stage === "closed") return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-auto bg-[rgba(19,26,46,.45)] p-6">
      <div className="relative max-h-[calc(100vh-80px)] w-full max-w-[452px] overflow-auto rounded-[14px] bg-bg shadow-lg">
        <button
          onClick={close}
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
              <Button onClick={openForm} className="h-11 flex-1 px-3.5 text-[13.5px] whitespace-nowrap">
                Tell us about yourself →
              </Button>
              <Button variant="secondary" onClick={close} className="h-11 flex-1 px-3.5 text-[13.5px] whitespace-nowrap">
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
                      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-neutral-600 text-pretty">{copy.sub}</p>
                      <div className="mt-4 flex flex-col gap-3.5">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-neutral-700">{copy.f1Label}</label>
                          <input
                            placeholder={copy.f1Hint}
                            value={f1}
                            onChange={(e) => setF1(e.target.value)}
                            className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm"
                          />
                        </div>
                        {copy.f2Key && (
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-neutral-700">{copy.f2Label}</label>
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
                      <label className="mb-1.5 block text-xs font-medium text-neutral-700">Years of experience</label>
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
                <button onClick={close} className="text-xs text-neutral-600">
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
              Thank you, {firstName}. Your professional details are on record and your programme recommendations now
              reflect your standing.
            </p>
            <div className="mt-[22px] flex flex-col items-center gap-2.5">
              <Link href="/portal/catalogue" className={buttonClassName("primary", "h-11 px-5")}>
                Browse programmes →
              </Link>
              <button onClick={close} className="text-xs text-neutral-600">
                Go to dashboard instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
