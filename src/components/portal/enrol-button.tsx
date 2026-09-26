"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { initiatePayment } from "@/app/actions/payment";
import { WaitlistNotice } from "@/components/beta/waitlist-notice";
import { BETA_FEATURE } from "@/lib/beta-types";

export function EnrolButton({ programmeId, label }: { programmeId: string; label: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [waitlisted, setWaitlisted] = React.useState(false);

  return (
    <div>
      <Button
        variant="primary"
        block
        disabled={pending || waitlisted}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await initiatePayment(programmeId);
              if (result.waitlisted) {
                setWaitlisted(true);
                return;
              }
              if (result.error || !result.checkoutUrl) {
                setError(result.error ?? "Something went wrong. Try again.");
                return;
              }
              window.location.href = result.checkoutUrl;
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
            }
          })
        }
      >
        {pending ? "Starting checkout…" : label}
      </Button>
      {error && <div className="text-[11.5px] text-[#b42318] mt-2">{error}</div>}
      {waitlisted && <WaitlistNotice feature={BETA_FEATURE.PROGRAMME} />}
    </div>
  );
}
