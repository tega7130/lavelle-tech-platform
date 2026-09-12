"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { initiatePayment } from "@/app/actions/payment";

export function EnrolButton({ programmeId, label }: { programmeId: string; label: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <Button
        variant="primary"
        block
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const result = await initiatePayment(programmeId);
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
    </div>
  );
}
