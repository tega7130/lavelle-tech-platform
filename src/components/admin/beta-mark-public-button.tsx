"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { markFeaturePublicAction } from "@/app/actions/beta-admin";
import type { BetaFeature } from "@/lib/beta-types";

export function MarkFeaturePublicButton({ feature, label }: { feature: BetaFeature; label: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [notified, setNotified] = React.useState<number | null>(null);

  function confirm() {
    startTransition(async () => {
      const result = await markFeaturePublicAction(feature);
      setNotified(result.notified);
      setOpen(false);
    });
  }

  return (
    <div>
      <Button type="button" variant="secondary" className="h-[38px] text-[12.5px]" onClick={() => setOpen(true)}>
        Mark public
      </Button>
      {notified !== null && (
        <div className="mt-1.5 text-[11.5px] text-success-text">
          {label} marked public — {notified} candidate(s) notified.
        </div>
      )}
      {open && (
        <Dialog
          open
          onClose={() => (pending ? undefined : setOpen(false))}
          title="Mark this feature public?"
          actions={
            <>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={confirm} disabled={pending}>
                {pending ? "Notifying…" : "Yes, mark public"}
              </Button>
            </>
          }
        >
          <p>
            Every waitlisted candidate for <strong>{label}</strong> will get a one-time notification that it&apos;s open.
            This can&apos;t be undone.
          </p>
        </Dialog>
      )}
    </div>
  );
}
