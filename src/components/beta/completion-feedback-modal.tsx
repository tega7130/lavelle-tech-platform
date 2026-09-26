"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { BetaFeature, BetaFeedbackKind } from "@/generated/prisma/client";
import { submitBetaFeedbackAction } from "@/app/actions/beta-access";

/**
 * Un-dismissable by design (no skip) — the calling page only renders this
 * once shouldShowBetaCompletionFeedbackAction returns true, and it never
 * returns true again for the same candidate/feature once this submits.
 */
export function CompletionFeedbackModal({ feature, heading }: { feature: BetaFeature; heading: string }) {
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (submitted) return null;

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please share a few words before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitBetaFeedbackAction(feature, BetaFeedbackKind.COMPLETION, trimmed);
      setSubmitted(true);
    } catch {
      setError("Something went wrong submitting your feedback. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={() => {}} title={heading} actions={
      <Button type="button" variant="primary" onClick={submit} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit"}
      </Button>
    }>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">You&apos;re one of the first to try this — tell us how it went.</p>
        <Field>
          <Textarea
            autoFocus
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's working, what's not, what would you change?"
          />
        </Field>
        {error && <div className="text-[12.5px] text-danger-heading">{error}</div>}
      </div>
    </Dialog>
  );
}
