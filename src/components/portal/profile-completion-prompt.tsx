"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CurrentCandidate } from "@/lib/candidate-session";
import { ProfileCompletionModal, type ProfileModalTrigger } from "@/components/portal/profile-completion-modal";

/**
 * The enrolled-dashboard counterpart to ApplicantDashboard's profile
 * checklist. A guest checkout ("Apply for this programme") creates the
 * candidate account only once payment confirms, then signs them straight
 * into the enrolled dashboard — they never pass through ApplicantDashboard
 * (gated on !isEnrolled), so without this they had no prompt anywhere to
 * fill in professional details, a photo or the handbook acknowledgement.
 * Renders nothing once all three are done.
 */
export function ProfileCompletionPrompt({ candidate }: { candidate: CurrentCandidate }) {
  const { checklist, firstName } = candidate;
  const searchParams = useSearchParams();

  const [trigger, setTrigger] = React.useState<ProfileModalTrigger>("closed");
  const [justCompleted, setJustCompleted] = React.useState(false);

  React.useEffect(() => {
    // Same deep link the Profile & ID page's "Edit"/"Add details" action
    // uses for the applicant dashboard — /portal/dashboard?complete=professional
    // previously only worked pre-enrolment; this makes it work here too.
    if (searchParams.get("complete") === "professional") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrigger("form");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const professionalDone = checklist.professional || justCompleted;
  const items = [
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

  const doneCount = items.filter((it) => it.done).length;
  if (doneCount === items.length) return null;

  return (
    <>
      <div className="rounded-md border border-accent-200 bg-accent-100 p-5 px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="m-0">Complete your profile</h3>
          <div className="text-xs text-neutral-600">
            {doneCount} of {items.length} complete
          </div>
        </div>
        <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
          />
        </div>
        <div className="mt-4 border-t border-dashed border-accent-300">
          {items.map((it) => (
            <div key={it.key} className="flex items-start gap-3 border-b border-dashed border-accent-300 py-3 last:border-b-0">
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
                <button onClick={it.action.onClick} className="mt-px flex-none text-xs font-medium text-accent">
                  {it.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ProfileCompletionModal
        firstName={firstName}
        trigger={trigger}
        onClose={() => setTrigger("closed")}
        onSaved={() => setJustCompleted(true)}
      />
    </>
  );
}
