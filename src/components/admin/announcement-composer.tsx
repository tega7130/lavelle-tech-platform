"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field, Label } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { composeAnnouncementAction, sendAnnouncementAction, scheduleAnnouncementAction, previewAudienceAction } from "@/app/actions/announcements";
import type { Channel } from "@/generated/prisma/client";
import type { AudienceFilter } from "@/lib/announcement-audience";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "IN_APP", label: "In-app" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" },
];

export function AnnouncementComposer() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState<AudienceFilter["enrolmentStatus"]>("ALL");
  const [channels, setChannels] = React.useState<Channel[]>(["IN_APP"]);
  const [scheduledFor, setScheduledFor] = React.useState("");
  const [recipientCount, setRecipientCount] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previewAudienceAction({ enrolmentStatus: audience }).then(setRecipientCount);
  }, [open, audience]);

  function toggleChannel(c: Channel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit(mode: "send" | "schedule" | "draft") {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    if (channels.length === 0) {
      setError("Choose at least one delivery channel.");
      return;
    }
    if (mode === "schedule" && !scheduledFor) {
      setError("Choose a date and time to schedule for.");
      return;
    }
    setBusy(true);
    try {
      const announcement = await composeAnnouncementAction({ title, body, audienceFilter: { enrolmentStatus: audience }, channels });
      if (mode === "send") await sendAnnouncementAction(announcement.id);
      if (mode === "schedule") await scheduleAnnouncementAction(announcement.id, new Date(scheduledFor));
      setOpen(false);
      setTitle("");
      setBody("");
      setChannels(["IN_APP"]);
      setScheduledFor("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        New announcement
      </Button>
    );
  }

  return (
    <Card elev="sm" className="mb-[var(--space-6)]">
      <div className="flex flex-col gap-3">
        <Field>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. September 2026 intake now open" />
        </Field>
        <Field>
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>Audience</Label>
            <select
              className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AudienceFilter["enrolmentStatus"])}
            >
              <option value="ALL">All candidates</option>
              <option value="ENROLLED">Enrolled candidates</option>
              <option value="APPLICANT">Applicants only</option>
            </select>
            <div className="text-[11px] text-neutral-500 mt-1">
              {recipientCount === null ? "Calculating…" : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
            </div>
          </Field>

          <Field>
            <Label>Channels</Label>
            <div className="flex flex-col gap-1.5 mt-1">
              {CHANNELS.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-[13px]">
                  <Checkbox checked={channels.includes(c.value)} onChange={() => toggleChannel(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <Field>
          <Label>Schedule for (optional)</Label>
          <input
            type="datetime-local"
            className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </Field>

        {error && <div className="text-[12.5px] text-[#b42318]">{error}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {scheduledFor ? (
            <Button variant="primary" disabled={busy} onClick={() => submit("schedule")}>
              Schedule
            </Button>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => submit("send")}>
              Send now
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
