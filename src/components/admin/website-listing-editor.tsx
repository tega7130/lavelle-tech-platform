"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea, Field, Label, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { formatNaira, tierLabel } from "@/lib/format";
import { upsertListingAction, publishListingAction, unpublishListingAction } from "@/app/actions/website-admin";
import type { getListingForEditor } from "@/lib/website-admin";

type ListingData = Awaited<ReturnType<typeof getListingForEditor>>;

export function WebsiteListingEditor({ listing: programme }: { listing: ListingData }) {
  const router = useRouter();
  const existing = programme.listing;
  const [useDefaults, setUseDefaults] = React.useState(existing?.useDefaults ?? true);
  const [headline, setHeadline] = React.useState(existing?.headline ?? programme.title);
  const [summary, setSummary] = React.useState(existing?.summary ?? programme.summary);
  const [outcomes, setOutcomes] = React.useState<string[]>((existing?.outcomes as string[] | null) ?? []);
  const [includes, setIncludes] = React.useState<string[]>((existing?.includes as string[] | null) ?? []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const isPublished = existing?.isPublished ?? false;
  const totalLectures = programme.modules.reduce((sum, m) => sum + m.lectures.length, 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await upsertListingAction(programme.id, {
        useDefaults,
        headline: useDefaults ? null : headline,
        summary: useDefaults ? null : summary,
        outcomes: useDefaults ? undefined : outcomes,
        includes: useDefaults ? undefined : includes,
      });
      setNotice("Listing updated. The public page reflects these changes immediately.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await save();
      await publishListingAction(programme.id);
      setNotice(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function submitUnpublish() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await unpublishListingAction(programme.id, reason);
      setUnpublishing(false);
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card elev="sm" className={isPublished ? "border-[#bfe3cd]" : undefined}>
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-[9px] flex-wrap">
              <Tag variant="accent">{tierLabel(programme.tier)}</Tag>
              <span className="text-neutral-500 text-[12px]">{programme.code}</span>
            </div>
            <div className="font-heading font-semibold text-[19px] mt-[7px]">{programme.title}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tag variant={isPublished ? "success" : "neutral"}>{isPublished ? "Live on the website" : "Not published"}</Tag>
            {isPublished && (
              <Button variant="secondary" className="h-9 text-[12.5px]" onClick={() => setUnpublishing(true)}>
                Unpublish
              </Button>
            )}
            <Button variant="primary" className="h-9 text-[12.5px]" disabled={busy} onClick={publish}>
              {isPublished ? "Update listing" : "Publish to website"}
            </Button>
          </div>
        </div>

        {(notice || error) && (
          <div
            className={
              error
                ? "flex items-start gap-[10px] px-4 py-3 rounded-md mt-4 bg-[#fef3f2] border border-[#f3c4bf] text-[#912019] text-[12px]"
                : "flex items-start gap-[10px] px-4 py-3 rounded-md mt-4 bg-[#e7f6ed] border border-[#bfe3cd] text-[#116632] text-[12px]"
            }
          >
            <span className="flex-none font-bold">{error ? "!" : "✓"}</span>
            <div className="leading-[1.55] text-wrap-pretty">{error ?? notice}</div>
          </div>
        )}
      </Card>

      <Card elev="sm">
        <CardKicker>Listing content</CardKicker>
        <div className="text-neutral-600 text-[12px] leading-[1.55] mt-1">Start from the programme record, or write copy specifically for the public page.</div>

        <div className="flex mt-4 border border-neutral-300 rounded-md overflow-hidden w-full">
          {[
            { value: true, label: "Use the programme record" },
            { value: false, label: "Write custom copy" },
          ].map((o, i) => (
            <label
              key={o.label}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-[13px] font-medium cursor-pointer ${i > 0 ? "border-l border-neutral-300" : ""} ${useDefaults === o.value ? "text-accent bg-accent-100" : "hover:bg-neutral-100"}`}
            >
              <input type="radio" name="web-source" className="sr-only" checked={useDefaults === o.value} onChange={() => setUseDefaults(o.value)} />
              {o.label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-4 mt-5">
          {!useDefaults && (
            <Field>
              <Label>Headline</Label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </Field>
          )}
          <Field>
            <Label>Summary shown under the title</Label>
            <Textarea rows={3} value={useDefaults ? programme.summary : summary} onChange={(e) => setSummary(e.target.value)} disabled={useDefaults} />
          </Field>

          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">At a glance (from the programme record)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {[
                ["Length", `${programme.weeks} weeks`],
                ["Commitment", programme.weeklyHoursLabel],
                ["Credits", String(programme.credits)],
                ["Delivery", programme.deliveryLabel],
              ].map(([label, value]) => (
                <div key={label} className="px-3 py-[10px] rounded-md bg-neutral-100 border border-divider">
                  <div className="text-[9.5px] tracking-[0.08em] uppercase text-neutral-600">{label}</div>
                  <div className="font-medium text-[13px] mt-[3px]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <ListField label="What you will be able to do" items={outcomes} setItems={setOutcomes} disabled={useDefaults} />
          <ListField label="What enrolment includes" items={includes} setItems={setIncludes} disabled={useDefaults} />

          <Field>
            <Label>Programme fee</Label>
            <Input value={formatNaira(programme.feeMinor)} disabled />
          </Field>
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="secondary" disabled={busy} onClick={save}>
            Save
          </Button>
        </div>
      </Card>

      <Card elev="sm" className="bg-neutral-100">
        <CardKicker>Inherited from the programme record</CardKicker>
        <div className="text-neutral-600 text-[12px] leading-[1.55] mt-1">These publish automatically and are edited in Programmes, not here.</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4 pt-4 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Syllabus ({totalLectures} lecture{totalLectures === 1 ? "" : "s"})</div>
            <div className="flex flex-col gap-[7px] mt-3">
              {programme.modules.map((m) => (
                <div key={m.id} className="flex gap-[9px] text-[12.5px] leading-[1.5]">
                  <span className="text-neutral-500 flex-none">Week {m.weekNumber}</span>
                  <span>{m.title}</span>
                </div>
              ))}
              {programme.modules.length === 0 && <div className="text-neutral-500 text-[12px]">No modules yet.</div>}
            </div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">How you will be assessed</div>
            <div className="flex flex-col gap-[7px] mt-3">
              {programme.assessmentWeightings.map((a) => (
                <div key={a.kind} className="flex justify-between gap-3 text-[12.5px]">
                  <span>{a.kind}</span>
                  <span className="text-neutral-500 flex-none">{a.weightPercent}%</span>
                </div>
              ))}
              {programme.assessmentWeightings.length === 0 && <div className="text-neutral-500 text-[12px]">Not configured yet.</div>}
            </div>
          </div>
        </div>
      </Card>

      {unpublishing && (
        <Dialog open onClose={() => setUnpublishing(false)} title="Unpublish this listing?">
          <p>The public page is removed from the site immediately. This never affects enrolment — candidates already enrolled, or with a direct link, keep full access.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for unpublishing" rows={2} className="mt-3" />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setUnpublishing(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !reason.trim()} onClick={submitUnpublish}>
              Unpublish
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ListField({
  label,
  items,
  setItems,
  disabled,
}: {
  label: string;
  items: string[];
  setItems: (v: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline gap-3">
        <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">{label}</div>
        {!disabled && (
          <button type="button" onClick={() => setItems([...items, ""])} className="text-[11.5px] font-medium text-accent">
            + Add a line
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 mt-3">
        {items.length === 0 && <div className="text-neutral-500 text-[12px]">None yet.</div>}
        {items.map((text, i) => (
          <div key={i} className="flex items-center gap-[10px]">
            <span className="w-[18px] h-[18px] flex-none rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-[10px] font-bold">✓</span>
            <Input
              className="flex-1"
              value={text}
              disabled={disabled}
              onChange={(e) => {
                const next = items.slice();
                next[i] = e.target.value;
                setItems(next);
              }}
            />
            {!disabled && (
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="flex-none w-[30px] h-[30px] rounded-md border border-divider bg-bg text-neutral-600"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
