"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { previewLocationCleanupAction, applyLocationCleanupAction } from "@/app/actions/candidate-admin";

type LocationChange = { from: string; to: string; count: number };
type Preview = { changes: LocationChange[]; candidatesAffected: number; unmatched: { value: string; count: number }[] };
type ApplyResult = { candidatesUpdated: number; changes: LocationChange[] };

export function LocationCleanupPanel() {
  const router = useRouter();
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [result, setResult] = React.useState<ApplyResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setPreview(await previewLocationCleanupAction());
    } catch {
      setError("Could not load a preview. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      setResult(await applyLocationCleanupAction());
      setPreview(null);
      router.refresh();
    } catch {
      setError("Could not apply the cleanup. Try again.");
    } finally {
      setApplying(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border border-accent-2-300 bg-accent-2-100 p-3.5 text-[13px] text-accent-2-800">
        Updated {result.candidatesUpdated} candidate{result.candidatesUpdated === 1 ? "" : "s"} across{" "}
        {result.changes.length} distinct value{result.changes.length === 1 ? "" : "s"}.
      </div>
    );
  }

  if (!preview) {
    return (
      <div>
        <Button variant="secondary" disabled={loading} onClick={loadPreview} className="h-[34px] px-3.5 text-[12.5px]">
          {loading ? "Checking…" : "Preview changes"}
        </Button>
        {error && <div className="mt-2 text-[12.5px] text-[#912019]">{error}</div>}
      </div>
    );
  }

  if (preview.changes.length === 0) {
    return <div className="text-neutral-500 text-[13px]">Nothing to clean up — every value is already canonical.</div>;
  }

  return (
    <div>
      <div className="border border-divider rounded-md overflow-hidden mb-3">
        {preview.changes.map((c) => (
          <div
            key={c.from}
            className="flex items-center gap-3 px-3.5 py-2.5 border-b border-dashed border-neutral-300 last:border-b-0 text-[13px]"
          >
            <span className="text-neutral-600 truncate flex-1">&ldquo;{c.from}&rdquo;</span>
            <span className="text-neutral-400 flex-none">&rarr;</span>
            <span className="text-text truncate flex-1">{c.to}</span>
            <span className="tabular-nums text-neutral-500 flex-none text-[12px]">
              {c.count} candidate{c.count === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>

      {preview.unmatched.length > 0 && (
        <div className="mb-3 text-[12px] text-neutral-500">
          {preview.unmatched.length} other value{preview.unmatched.length === 1 ? "" : "s"} left as-is (not confidently
          recognized as a Nigerian state) — {preview.unmatched.map((u) => `"${u.value}"`).join(", ")}
        </div>
      )}

      {error && <div className="mb-2 text-[12.5px] text-[#912019]">{error}</div>}

      <div className="flex items-center gap-2.5">
        <Button disabled={applying} onClick={apply} className="h-[34px] px-3.5 text-[12.5px]">
          {applying
            ? "Applying…"
            : `Apply — merge ${preview.candidatesAffected} record${preview.candidatesAffected === 1 ? "" : "s"}`}
        </Button>
        <button
          onClick={() => setPreview(null)}
          disabled={applying}
          className="text-[12.5px] font-medium text-neutral-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
