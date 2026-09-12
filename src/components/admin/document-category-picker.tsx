"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createDocumentCategoryAction } from "@/app/actions/document-library";

export interface DocumentCategoryOption {
  id: string;
  name: string;
}

/**
 * The category picker shared by Upload and Edit — pill buttons for every
 * existing category plus an inline "+ New category" creator, same shape
 * as ProgrammeDetailsForm's own category picker (createCategory).
 */
export function DocumentCategoryPicker({
  categories,
  value,
  onChange,
  onCategoryCreated,
}: {
  categories: DocumentCategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
  onCategoryCreated?: (category: DocumentCategoryOption) => void;
}) {
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createDocumentCategoryAction(trimmed);
      onCategoryCreated?.(created);
      onChange(created.id);
      setCreating(false);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          dense
          className="flex-1"
          placeholder="e.g. Non-Disclosure Agreements"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <Button type="button" onClick={handleCreate} disabled={busy || !newName.trim()} className="h-[38px] flex-none text-[12.5px]">
          {busy ? "Creating…" : "Create"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCreating(false);
            setNewName("");
          }}
          className="h-[38px] flex-none text-[12.5px]"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-[7px]">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            "cursor-pointer rounded-full border-[1.5px] px-[13px] py-1.5 font-body text-[12.5px] font-medium",
            value === c.id ? "border-accent bg-accent-100 text-accent-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
          )}
        >
          {c.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="cursor-pointer rounded-full border-[1.5px] border-dashed border-neutral-400 bg-transparent px-[13px] py-1.5 font-body text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100"
      >
        + New category
      </button>
    </div>
  );
}
