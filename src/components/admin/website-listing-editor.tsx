"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
import { Textarea, Field, Label, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { formatNaira, tierLabel } from "@/lib/format";
import { upsertListingAction, publishListingAction, unpublishListingAction } from "@/app/actions/website-admin";
import { finaliseUpload } from "@/app/actions/uploads";
import type { getListingForEditor } from "@/lib/website-admin";

type ListingData = Awaited<ReturnType<typeof getListingForEditor>>;
type TabKey = "content" | "pricing" | "inherited";

const TABS: { key: TabKey; label: string }[] = [
  { key: "content", label: "Listing content" },
  { key: "pricing", label: "Pricing & details" },
  { key: "inherited", label: "Inherited" },
];

async function uploadVideo(file: File) {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "video", mimeType: file.type, bytes: file.size }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseUpload({ storageKey, kind: "video", mimeType: file.type, originalFilename: file.name });
}

export function WebsiteListingEditor({ listing: programme, initialTab }: { listing: ListingData; initialTab: TabKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const existing = programme.listing;
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  const [useDefaults, setUseDefaults] = React.useState(existing?.useDefaults ?? true);
  const [headline, setHeadline] = React.useState(existing?.headline ?? programme.title);
  const [summary, setSummary] = React.useState(existing?.summary ?? programme.summary);
  const [outcomes, setOutcomes] = React.useState<string[]>((existing?.outcomes as string[] | null) ?? []);
  const [includes, setIncludes] = React.useState<string[]>((existing?.includes as string[] | null) ?? []);
  const [useCoverVideo, setUseCoverVideo] = React.useState(existing?.useCoverVideo ?? true);
  const [videoMode, setVideoMode] = React.useState<"url" | "upload">(existing?.videoAsset ? "upload" : "url");
  const [videoUrl, setVideoUrl] = React.useState(existing?.videoUrl ?? "");
  const [videoAsset, setVideoAsset] = React.useState(existing?.videoAsset ?? null);
  const [videoUploading, setVideoUploading] = React.useState(false);
  const [videoError, setVideoError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const isPublished = existing?.isPublished ?? false;
  const totalLectures = programme.modules.reduce((sum, m) => sum + m.lectures.length, 0);

  // Shallow URL sync only — the tab itself is local state, switched
  // instantly with no server round-trip, so an in-progress edit on one
  // tab is never at risk of being discarded by navigating to another.
  // router.replace still keeps ?tab= shareable and refresh-persistent
  // (Slice 12 requirement) without remounting this component.
  function pickTab(key: TabKey) {
    setTab(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  }

  async function handleVideoUpload(file: File) {
    setVideoError(null);
    setVideoUploading(true);
    try {
      const asset = await uploadVideo(file);
      setVideoAsset({ id: asset.id, originalFilename: asset.originalFilename });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setVideoUploading(false);
    }
  }

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
        useCoverVideo,
        // Mutually exclusive, same rule as Programme.coverVideoUrl/
        // coverVideoAssetId (programme.ts's own upsert): whichever mode
        // is active wins, the other is cleared so a stale value can't
        // linger and get picked up if the mode is switched back later.
        videoUrl: useCoverVideo ? null : videoMode === "url" ? videoUrl : null,
        videoAssetId: useCoverVideo ? null : videoMode === "upload" ? (videoAsset?.id ?? null) : null,
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

  // Status note: an error always wins, then a just-saved confirmation,
  // then a steady-state description of what the current publish state
  // means for a visitor — visible regardless of which tab is open, same
  // as the header above it.
  const statusNote = error
    ? { tone: "error" as const, text: error }
    : notice
      ? { tone: "success" as const, text: notice }
      : isPublished
        ? {
            tone: "success" as const,
            text: "Visitors can find this programme in the catalogue and open its page. Registration remains free; the fee is shown on the listing.",
          }
        : { tone: "info" as const, text: "Not visible to visitors. Publishing adds it to the catalogue and creates its public page." };

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card elev="sm" className={isPublished ? "border-[#bfe3cd]" : undefined}>
        <div>
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

          <div
            className={cn(
              "flex items-start gap-[10px] px-4 py-3 rounded-md mt-4 text-[12px] leading-[1.55]",
              statusNote.tone === "error" && "bg-[#fef3f2] border border-[#f3c4bf] text-[#912019]",
              statusNote.tone === "success" && "bg-[#e7f6ed] border border-[#bfe3cd] text-[#116632]",
              statusNote.tone === "info" && "bg-accent-100 border border-accent-200 text-accent-800"
            )}
          >
            <span className="flex-none font-bold">{statusNote.tone === "error" ? "!" : statusNote.tone === "success" ? "✓" : "i"}</span>
            <div className="text-wrap-pretty">{statusNote.text}</div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-divider mt-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTab(t.key)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px",
                tab === t.key ? "border-accent text-accent" : "border-transparent text-neutral-600 hover:text-text"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 mt-5">
          {tab === "content" && (
            <>
              <div className="text-neutral-600 text-[12px] leading-[1.55]">
                Start from the programme record, or write copy specifically for the public page.
              </div>

              <div className="flex border border-neutral-300 rounded-md overflow-hidden w-full">
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

              <ListField label="What you will be able to do" items={outcomes} setItems={setOutcomes} disabled={useDefaults} />
              <ListField label="What enrolment includes" items={includes} setItems={setIncludes} disabled={useDefaults} />
            </>
          )}

          {tab === "pricing" && (
            <>
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

              <Field>
                <Label>Programme fee</Label>
                <Input value={formatNaira(programme.feeMinor)} disabled />
              </Field>

              <div className="mt-3 pt-4 border-t border-dashed border-neutral-300">
                <Label>Preview video</Label>
                <div className="text-neutral-600 text-[12px] leading-[1.55] mb-3">
                  Shown to visitors on the public page, before they register. Optional.
                </div>

                <div className="flex border border-neutral-300 rounded-md overflow-hidden w-full">
                  {[
                    { value: true, label: "Use the programme's cover video" },
                    { value: false, label: "Different video for the website" },
                  ].map((o, i) => (
                    <label
                      key={o.label}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-[13px] font-medium cursor-pointer ${i > 0 ? "border-l border-neutral-300" : ""} ${useCoverVideo === o.value ? "text-accent bg-accent-100" : "hover:bg-neutral-100"}`}
                    >
                      <input
                        type="radio"
                        name="video-source"
                        className="sr-only"
                        checked={useCoverVideo === o.value}
                        onChange={() => setUseCoverVideo(o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>

                <div className="mt-3">
                  {useCoverVideo ? (
                    programme.coverVideoUrl || programme.coverVideoAsset ? (
                      <div className="text-[12.5px] text-neutral-700 px-3 py-2.5 rounded-md bg-neutral-100 border border-divider">
                        {programme.coverVideoAsset ? `Uploaded file: ${programme.coverVideoAsset.originalFilename}` : programme.coverVideoUrl}
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-neutral-600 px-3 py-2.5 rounded-md bg-neutral-100 border border-divider">
                        This programme has no cover video yet. Add one from the programme&rsquo;s edit page, or choose
                        &ldquo;Different video for the website&rdquo; above.
                      </div>
                    )
                  ) : (
                    <>
                      <div className="flex gap-1.5 rounded-md bg-neutral-100 p-[3px] w-fit mb-3">
                        <button
                          type="button"
                          onClick={() => setVideoMode("url")}
                          className="h-8 rounded-[6px] px-3 text-[12.5px] font-medium"
                          style={{
                            background: videoMode === "url" ? "var(--color-accent-100)" : "transparent",
                            color: videoMode === "url" ? "var(--color-accent)" : "var(--color-neutral-700)",
                          }}
                        >
                          Link (e.g. YouTube)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoMode("upload")}
                          className="h-8 rounded-[6px] px-3 text-[12.5px] font-medium"
                          style={{
                            background: videoMode === "upload" ? "var(--color-accent-100)" : "transparent",
                            color: videoMode === "upload" ? "var(--color-accent)" : "var(--color-neutral-700)",
                          }}
                        >
                          Upload
                        </button>
                      </div>

                      {videoMode === "url" ? (
                        <Input
                          placeholder="https://www.youtube.com/watch?v=…"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer">
                            <span className={buttonClassName("secondary")}>
                              {videoUploading ? "Uploading…" : "Choose video file"}
                            </span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm"
                              className="hidden"
                              disabled={videoUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) handleVideoUpload(file);
                              }}
                            />
                          </label>
                          {videoAsset && <div className="text-[12.5px] text-neutral-600">{videoAsset.originalFilename}</div>}
                        </div>
                      )}
                      {videoError && <div className="mt-1.5 text-[11.5px] text-[#c0392b]">{videoError}</div>}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === "inherited" && (
            <>
              <div className="text-neutral-600 text-[12px] leading-[1.55]">These publish automatically and are edited in Programmes, not here.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            </>
          )}
        </div>

        <div className="flex justify-end mt-5 pt-4 border-t border-dashed border-neutral-300">
          <Button variant="secondary" disabled={busy} onClick={save}>
            Save
          </Button>
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
