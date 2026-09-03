"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { resendStaffInvitation } from "@/app/actions/staff-auth";

export function ResendInvitationButton({ staffId }: { staffId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<"sent" | "failed" | null>(null);

  async function resend() {
    setBusy(true);
    try {
      const { emailSent } = await resendStaffInvitation(staffId);
      setResult(emailSent ? "sent" : "failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={busy}
      className={`text-xs disabled:opacity-50 ${result === "failed" ? "text-[#b42318]" : "text-accent"}`}
      title={result === "failed" ? "The email could not be sent — try again or check the delivery configuration." : undefined}
    >
      {result === "sent" ? "Invitation resent" : result === "failed" ? "Email failed — retry" : busy ? "Sending…" : "Resend invitation"}
    </button>
  );
}
