"use client";

import * as React from "react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { manualGrantAction } from "@/app/actions/beta-admin";
import type { BetaFeature } from "@/lib/beta-types";

export function ManualGrantForm({ feature }: { feature: BetaFeature }) {
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await manualGrantAction(trimmed, feature);
      if (result.ok) {
        showToast({ tone: "success", message: `Granted access to ${trimmed}` });
        setEmail("");
      } else {
        showToast({ tone: "danger", message: result.error });
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Input
        dense
        type="email"
        placeholder="candidate@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-[220px]"
      />
      <Button type="button" variant="secondary" className="h-[38px] text-[12.5px]" onClick={submit} disabled={pending || !email.trim()}>
        {pending ? "Granting…" : "Grant access"}
      </Button>
    </div>
  );
}
