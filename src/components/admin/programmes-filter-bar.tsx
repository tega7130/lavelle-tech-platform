"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/field";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "FOUNDATION", label: "Foundation" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "ADVANCED_PRACTITIONER", label: "Advanced" },
];

export function ProgrammesFilterBar({ q, status, tier }: { q: string; status: string; tier: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented name="pstat" value={status} onChange={(v) => setParam("status", v)} options={STATUS_OPTIONS} />
        <Segmented name="ptier" value={tier} onChange={(v) => setParam("tier", v)} options={TIER_OPTIONS} />
        <Input
          dense
          placeholder="Search title or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", query);
          }}
          onBlur={() => setParam("q", query)}
          className="w-[220px]"
        />
      </div>
    </div>
  );
}
