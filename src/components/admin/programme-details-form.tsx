"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCategory } from "@/app/actions/programme";
import { emptyActionState, type FormActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";

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
