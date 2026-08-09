"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendAnnouncementAction, withdrawAnnouncementAction } from "@/app/actions/announcements";
import type { AnnouncementState } from "@/generated/prisma/client";

export function AnnouncementRowActions({ id, state }: { id: string; state: AnnouncementState }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  if (state === "SENT" || state === "WITHDRAWN") return null;

  async function send() {
    setBusy(true);
    try {
      await sendAnnouncementAction(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      await withdrawAnnouncementAction(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5 justify-end">
      <Button variant="primary" className="h-[28px] px-[10px] text-[11px]" disabled={busy} onClick={send}>
        Send now
      </Button>
      <Button variant="secondary" className="h-[28px] px-[10px] text-[11px]" disabled={busy} onClick={withdraw}>
        Withdraw
      </Button>
    </div>
  );
}
