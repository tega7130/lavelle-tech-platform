"use client";

import * as React from "react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { subscribeToComingSoonAction } from "@/app/actions/programme-notifications";

export function NotifyMeForm({ listingId, initialEmail }: { listingId: string; initialEmail?: string }) {
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await subscribeToComingSoonAction(listingId, email);
    setBusy(false);
    if (result?.ok) {
      setState("done");
    } else {
      setState("error");
      setError(result && !result.ok ? result.error : "Something went wrong. Try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="px-4 py-3 rounded-[9px] bg-accent-100 border border-accent-200 text-[12.5px] text-accent-800 leading-relaxed text-center">
        You&rsquo;re on the list — we&rsquo;ll email you the moment this opens.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full h-11 px-3 rounded-[9px] border border-divider bg-bg text-[13px] outline-none focus:border-accent-200"
      />
      <button type="submit" disabled={busy} className={cn(buttonClassName("primary"), "w-full rounded-[9px]")}>
        {busy ? "Submitting…" : "Notify me when it opens"}
      </button>
      {error && <div className="text-[11.5px] text-[#c0392b] text-center">{error}</div>}
    </form>
  );
}
