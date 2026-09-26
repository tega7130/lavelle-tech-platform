"use client";

import * as React from "react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { manualGrantAction } from "@/app/actions/beta-admin";
import type { BetaFeature } from "@/lib/beta-types";

export function ManualGrantForm({ feature }: { feature: BetaFeature }) {
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function submit() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setMessage(null);
    startTransition(async () => {
      const result = await manualGrantAction(trimmed, feature);
      if (result.ok) {
        setMessage({ tone: "success", text: `Granted access to ${trimmed}` });
        setEmail("");
      } else {
        setMessage({ tone: "danger", text: result.error });
      }
    });
  }

  return (
    <div>
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
      {message && (
        <div className={`mt-1.5 text-[11.5px] ${message.tone === "success" ? "text-success-text" : "text-danger-heading"}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
