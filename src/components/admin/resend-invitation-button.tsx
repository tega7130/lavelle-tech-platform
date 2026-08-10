"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { resendStaffInvitation } from "@/app/actions/staff-auth";

export function ResendInvitationButton({ staffId }: { staffId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function resend() {
    setBusy(true);
    try {
      await resendStaffInvitation(staffId);
      setSent(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={resend} disabled={busy} className="text-accent text-xs disabled:opacity-50">
      {sent ? "Invitation resent" : busy ? "Sending…" : "Resend invitation"}
    </button>
  );
}
