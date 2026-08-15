"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCategory } from "@/app/actions/programme";
import { finaliseUpload } from "@/app/actions/uploads";
import { emptyActionState, type FormActionState } from "@/lib/action-state";
import { Button, buttonClassName } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";

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

export interface CategoryOption {
  id: string;
  name: string;
}

export interface ProgrammeDetailsFormProps {
  mode: "create" | "edit";
  programmeId?: string;
  categories: CategoryOption[];
  initialValues?: {
    title: string;
    code: string;
    categoryId: string;
    tier: string;
    summary: string;
    weeks: number;
    weeklyHoursLabel: string;
    credits: number;
    feeNaira: number;
    deliveryLabel: string;
    prerequisiteTier: string | null;
    coverVideoUrl?: string | null;
    coverVideoAsset?: { id: string; originalFilename: string } | null;
  };
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
}

const TIERS = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "ADVANCED_PRACTITIONER", label: "Advanced Practitioner" },
];

export function ProgrammeDetailsForm({ mode, programmeId, categories: initialCategories, initialValues, action }: ProgrammeDetailsFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, emptyActionState);
  const [categories, setCategories] = React.useState(initialCategories);
  const [categoryId, setCategoryId] = React.useState(initialValues?.categoryId ?? "");
  const [creatingCategory, setCreatingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [tier, setTier] = React.useState(initialValues?.tier ?? "SPECIALIST");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [prevStateErrors, setPrevStateErrors] = React.useState(state.errors);
  const [videoMode, setVideoMode] = React.useState<"url" | "upload">(initialValues?.coverVideoAsset ? "upload" : "url");
  const [coverVideoUrl, setCoverVideoUrl] = React.useState(initialValues?.coverVideoUrl ?? "");
  const [coverVideoAsset, setCoverVideoAsset] = React.useState(initialValues?.coverVideoAsset ?? null);
  const [videoUploading, setVideoUploading] = React.useState(false);
  const [videoError, setVideoError] = React.useState<string | null>(null);

  async function handleVideoUpload(file: File) {
    setVideoError(null);
    setVideoUploading(true);
    try {
      const asset = await uploadVideo(file);
      setCoverVideoAsset({ id: asset.id, originalFilename: asset.originalFilename });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setVideoUploading(false);
    }
  }

  if (state.errors !== prevStateErrors) {
    setPrevStateErrors(state.errors);
    setErrors(state.errors ?? {});
  }

  React.useEffect(() => {
    if (mode === "create" && state.ok && state.data?.id) {
      router.push(`/admin/programmes/${state.data.id}/content`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.data]);

  async function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const created = await createCategory(trimmed);
    setCategories((cats) => (cats.some((c) => c.id === created.id) ? cats : [...cats, created]));
    setCategoryId(created.id);
    setCreatingCategory(false);
    setNewCategoryName("");
  }

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-4">
      {state.message && (
        <div className="rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <div>
          <Label htmlFor="title">Programme title</Label>
          <Input id="title" name="title" defaultValue={initialValues?.title} invalid={!!errors.title} />
          <FieldError>{errors.title}</FieldError>
        </div>
        <div>
          <Label htmlFor="code">Programme code</Label>
          <Input
            id="code"
            name="code"
            placeholder="ELR-201"
            defaultValue={initialValues?.code}
            invalid={!!errors.code}
            className="uppercase"
          />
          <FieldError>{errors.code}</FieldError>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="tier">Ladder level</Label>
          <select
            id="tier"
            name="tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm text-text"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="weeks">Weeks</Label>
          <Input id="weeks" name="weeks" type="number" min={1} defaultValue={initialValues?.weeks} invalid={!!errors.weeks} />
          <FieldError>{errors.weeks}</FieldError>
        </div>
        <div>
          <Label htmlFor="credits">Credits</Label>
          <Input id="credits" name="credits" type="number" min={1} defaultValue={initialValues?.credits} invalid={!!errors.credits} />
          <FieldError>{errors.credits}</FieldError>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="weeklyHoursLabel">Weekly hours</Label>
          <Input
            id="weeklyHoursLabel"
            name="weeklyHoursLabel"
            placeholder="6–8 hrs / week"
            defaultValue={initialValues?.weeklyHoursLabel}
            invalid={!!errors.weeklyHoursLabel}
          />
          <FieldError>{errors.weeklyHoursLabel}</FieldError>
        </div>
        <div>
          <Label htmlFor="feeNaira">Fee (₦)</Label>
          <Input
            id="feeNaira"
            name="feeNaira"
            type="number"
            min={0}
            step={1}
            placeholder="450000"
            defaultValue={initialValues?.feeNaira}
            invalid={!!errors.feeNaira}
          />
          <FieldError>{errors.feeNaira}</FieldError>
        </div>
      </div>

      {tier === "ADVANCED_PRACTITIONER" && (
        <div>
          <Label htmlFor="prerequisiteTier">Prerequisite tier</Label>
          <select
            id="prerequisiteTier"
            name="prerequisiteTier"
            defaultValue={initialValues?.prerequisiteTier ?? "SPECIALIST"}
            className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm text-text"
          >
            <option value="SPECIALIST">Specialist</option>
          </select>
          <div className="mt-1.5 text-[11.5px] text-neutral-600">
            Advanced Practitioner requires a Specialist credential (enforced in Slice 06).
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="deliveryLabel">Delivery</Label>
        <Input id="deliveryLabel" name="deliveryLabel" defaultValue={initialValues?.deliveryLabel ?? "Online + proctored exam"} />
      </div>

      <div>
        <Label>Cover video</Label>
        <div className="mb-2 text-[11.5px] text-neutral-600">
          Shown on the catalogue page so candidates can get a feel for the programme before enrolling.
        </div>
        <div className="mb-2.5 flex gap-1.5 rounded-[9px] border border-neutral-300 bg-bg p-1 w-fit">
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
          <>
            <Input
              name="coverVideoUrl"
              placeholder="https://www.youtube.com/watch?v=…"
              value={coverVideoUrl}
              onChange={(e) => setCoverVideoUrl(e.target.value)}
              invalid={!!errors.coverVideoUrl}
            />
            <FieldError>{errors.coverVideoUrl}</FieldError>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <input type="hidden" name="coverVideoAssetId" value={coverVideoAsset?.id ?? ""} />
            <label className="cursor-pointer">
              <span className={buttonClassName("secondary")}>{videoUploading ? "Uploading…" : "Choose video file"}</span>
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
            {coverVideoAsset && <div className="text-[12.5px] text-neutral-600">{coverVideoAsset.originalFilename}</div>}
          </div>
        )}
        {videoError && <div className="mt-1.5 text-[11.5px] text-[#c0392b]">{videoError}</div>}
      </div>

      <div>
        <Label>Category</Label>
        {!creatingCategory ? (
          <div className="flex flex-wrap gap-[7px]">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className="cursor-pointer rounded-full px-[13px] py-1.5 font-body text-[12.5px] font-medium"
                style={{
                  border: `1.5px solid ${categoryId === c.id ? "var(--color-accent)" : "var(--color-neutral-300)"}`,
                  background: categoryId === c.id ? "var(--color-accent-100)" : "transparent",
                  color: categoryId === c.id ? "var(--color-accent-700)" : "var(--color-neutral-700)",
                }}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCreatingCategory(true)}
              className="cursor-pointer rounded-full border-[1.5px] border-dashed border-neutral-400 bg-transparent px-[13px] py-1.5 font-body text-[12.5px] font-medium text-neutral-600"
            >
              + New category
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              className="flex-1"
              placeholder="e.g. Energy & Natural Resources"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <Button type="button" onClick={handleCreateCategory} className="h-[38px] flex-none text-[12.5px]">
              Create
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreatingCategory(false)}
              className="h-[38px] flex-none text-[12.5px]"
            >
              Cancel
            </Button>
          </div>
        )}
        <input type="hidden" name="categoryId" value={categoryId} />
        <FieldError>{errors.categoryId}</FieldError>
      </div>

      <div>
        <Label htmlFor="summary">Overview shown to candidates</Label>
        <Textarea id="summary" name="summary" rows={3} defaultValue={initialValues?.summary} invalid={!!errors.summary} />
        <FieldError>{errors.summary}</FieldError>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-neutral-300 pt-4">
        <Link href="/admin/programmes" className="text-sm text-neutral-600">
          ← Back to programmes
        </Link>
        <div className="flex items-center gap-2">
          {mode === "edit" && programmeId && (
            <Link href={`/admin/programmes/${programmeId}/content`} className="text-sm font-medium text-accent">
              Course content →
            </Link>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Next: course content →" : "Save details"}
          </Button>
        </div>
      </div>
    </form>
  );
}
