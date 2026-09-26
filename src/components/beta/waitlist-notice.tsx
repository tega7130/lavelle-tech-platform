"use client";

import * as React from "react";
import { Field, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { BetaFeature, BetaFeedbackKind } from "@/generated/prisma/client";
import { submitBetaFeedbackAction } from "@/app/actions/beta-access";

const FEATURE_LABEL: Record<BetaFeature, string> = {
  [BetaFeature.PROGRAMME]: "course enrolment",
  [BetaFeature.DOCUMENT_LIBRARY]: "Document Library",
};

/** Shown in place of an error toast when a checkout action returns `waitlisted: true`. */
export function WaitlistNotice({ feature }: { feature: BetaFeature }) {
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "submitted" | "skipped">("idle");

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await submitBetaFeedbackAction(feature, BetaFeedbackKind.WAITLIST_INTEREST, trimmed);
      setState("submitted");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-divider p-4 mt-3 flex flex-col gap-3">
      <div>
        <div className="font-heading font-semibold text-[14px]">Beta access is full</div>
        <div className="text-[13px] text-neutral-600 mt-1">
          We&apos;re running {FEATURE_LABEL[feature]} with our first 10 candidates so we can get focused feedback before
          opening it up to everyone. That group is full, but you&apos;re on the waitlist — we&apos;ll let you know the
          moment it opens.
        </div>
      </div>

      {state === "idle" && (
        <Field>
          <Textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What would make you interested once it's open? (optional)"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" className="h-[34px] text-[12.5px]" onClick={() => setState("skipped")}>
              Skip
            </Button>
            <Button
              type="button"
              variant="primary"
              className="h-[34px] text-[12.5px]"
              onClick={submit}
              disabled={submitting || !message.trim()}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </Field>
      )}
      {state === "submitted" && <div className="text-[12.5px] text-success-text">Thanks — we&apos;ll be in touch.</div>}
    </div>
  );
}
