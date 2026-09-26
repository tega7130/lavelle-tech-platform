"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { markFeaturePublicAction } from "@/app/actions/beta-admin";
import type { BetaFeature } from "@/lib/beta-types";

export function MarkFeaturePublicButton({ feature, label }: { feature: BetaFeature; label: string }) {
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await markFeaturePublicAction(feature);
      showToast({ tone: "success", message: `${label} marked public — ${result.notified} candidate(s) notified.` });
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" className="h-[38px] text-[12.5px]" onClick={() => setOpen(true)}>
        Mark public
      </Button>
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
    </>
  );
}
