"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { duplicateProgramme } from "@/app/actions/programme";
import { generateProgrammeCode } from "@/lib/programme-code";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/field";
import type { ProgrammeTier } from "@/generated/prisma/client";

const TIERS: { value: ProgrammeTier; label: string }[] = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "ADVANCED_PRACTITIONER", label: "Advanced Practitioner" },
];

export interface PracticeAreaOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Duplicating into the SAME practice area + tier as the source is
 * impossible by construction — the source itself already holds that
 * code — so this can never be a one-click action. The admin confirms (or
 * changes) the target practice area and tier here, sees the resulting
 * code before committing, and only then is the copy created.
 */
export function DuplicateProgrammeDialog({
  programmeId,
  sourceTitle,
  sourcePracticeAreaId,
  sourceTier,
  practiceAreas,
  trigger,
}: {
  programmeId: string;
  sourceTitle: string;
  sourcePracticeAreaId: string | null;
  sourceTier: ProgrammeTier;
  practiceAreas: PracticeAreaOption[];
  trigger: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [practiceAreaId, setPracticeAreaId] = React.useState(sourcePracticeAreaId ?? practiceAreas[0]?.id ?? "");
  const [tier, setTier] = React.useState<ProgrammeTier>(sourceTier);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedPracticeArea = practiceAreas.find((p) => p.id === practiceAreaId);
  const previewCode = selectedPracticeArea ? generateProgrammeCode(selectedPracticeArea.code, tier) : null;

  function openDialog() {
    setError(null);
    setPracticeAreaId(sourcePracticeAreaId ?? practiceAreas[0]?.id ?? "");
    setTier(sourceTier);
    setOpen(true);
  }

  async function handleConfirm() {
    if (!practiceAreaId) {
      setError("Choose a practice area.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const copy = await duplicateProgramme(programmeId, practiceAreaId, tier);
      router.push(`/admin/programmes/${copy.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate this programme.");
      setPending(false);
    }
  }

  return (
    <>
      {trigger(openDialog)}
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Duplicate programme">
        <p className="text-[13px] text-neutral-600">
          Creates a new draft copy of &ldquo;{sourceTitle}&rdquo;. Choose the practice area and tier for the copy — it
          can&rsquo;t reuse {sourceTier === tier && practiceAreaId === sourcePracticeAreaId ? "the same" : "a taken"} code, so
          pick a different tier or practice area if the original combination is still in use.
        </p>

        <div className="mt-3.5 flex flex-col gap-3.5">
          <div>
            <Label htmlFor="dup-practice-area">Practice area</Label>
            <select
              id="dup-practice-area"
              value={practiceAreaId}
              onChange={(e) => setPracticeAreaId(e.target.value)}
              className="h-11 w-full rounded-md border border-neutral-300 bg-bg px-3 text-sm text-text"
            >
              {practiceAreas.length === 0 && <option value="">No practice areas yet</option>}
              {practiceAreas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="dup-tier">Tier</Label>
            <select
              id="dup-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as ProgrammeTier)}
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
            <Label>Programme code</Label>
            <div className="h-11 flex items-center rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3 text-sm font-medium tabular-nums text-text">
              {previewCode ?? "Choose a practice area"}
            </div>
          </div>

          <FieldError>{error}</FieldError>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !practiceAreaId} onClick={handleConfirm}>
            {pending ? "Duplicating…" : "Duplicate"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
