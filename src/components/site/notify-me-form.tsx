"use client";

import * as React from "react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { subscribeToComingSoonAction } from "@/app/actions/programme-notifications";
import { PHONE_CODES } from "@/lib/phone-codes";

export function NotifyMeForm({
  listingId,
  initialName,
  initialPhoneCountryCode,
  initialPhone,
  initialEmail,
}: {
  listingId: string;
  initialName?: string;
  initialPhoneCountryCode?: string;
  initialPhone?: string;
  initialEmail?: string;
}) {
  const [name, setName] = React.useState(initialName ?? "");
  const [phoneCountryCode, setPhoneCountryCode] = React.useState(initialPhoneCountryCode ?? "+234");
  const [phone, setPhone] = React.useState(initialPhone ?? "");
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await subscribeToComingSoonAction(listingId, name, phoneCountryCode, phone, email);
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
        type="text"
        required
        aria-label="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full h-11 px-3 rounded-[9px] border border-divider bg-bg text-[13px] outline-none focus:border-accent-200"
      />
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={phoneCountryCode}
          onChange={(e) => setPhoneCountryCode(e.target.value)}
          className="h-11 w-[104px] flex-none rounded-[9px] border border-divider bg-bg px-2 text-[13px] outline-none focus:border-accent-200"
        >
          {PHONE_CODES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="tel"
          required
          aria-label="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="803 552 8841"
          className="w-full h-11 px-3 rounded-[9px] border border-divider bg-bg text-[13px] outline-none focus:border-accent-200"
        />
      </div>
      <input
        type="email"
        required
        aria-label="Email address"
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
