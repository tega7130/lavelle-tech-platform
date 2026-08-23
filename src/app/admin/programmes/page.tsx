import Link from "next/link";
import { listProgrammes } from "@/lib/programme-reads";
import { getCurrentStaff } from "@/lib/staff-session";
import { formatNaira, tierLabel, statusLabel } from "@/lib/format";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { ProgrammesFilterBar } from "@/components/admin/programmes-filter-bar";
import { ProgrammeRowActions } from "@/components/admin/programme-row-actions";
import type { ProgrammeStatus, ProgrammeTier } from "@/generated/prisma/client";

const STATUS_TAG_VARIANT: Record<string, "success" | "neutral"> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
};

export default async function ProgrammesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const [programmes, currentStaff] = await Promise.all([
    listProgrammes({
      q: sp.q,
      tier: (sp.tier as ProgrammeTier) || undefined,
      status: (sp.status as ProgrammeStatus) || undefined,
    }),
    getCurrentStaff(),
  ]);

  return (
    <div className="max-w-[1280px]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <ProgrammesFilterBar q={sp.q ?? ""} status={sp.status ?? ""} tier={sp.tier ?? ""} />
        <Link href="/admin/programmes/new" className={buttonClassName("primary")}>
          + New programme
        </Link>
      </div>

      <div className="overflow-hidden rounded-md border border-divider">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-divider py-[10px] pr-2 pl-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                Programme
              </th>
              <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                Level
              </th>
              <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                Enrolled
              </th>
              <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                Fee
              </th>
              <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                Status
              </th>
              <th className="border-b border-divider py-[10px] pr-[var(--space-4)]" />
            </tr>
          </thead>
          <tbody>
            {programmes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-[var(--space-4)] py-8 text-center text-sm text-neutral-500">
                  No programmes match these filters.
                </td>
              </tr>
            )}
            {programmes.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-100">
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 pl-[var(--space-4)]">
                  <div className="text-sm">{p.title}</div>
                  <div className="text-[11.5px] text-neutral-600">
                    {p.code} · {p.category.name}
                  </div>
                </td>
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px]">{tierLabel(p.tier)}</td>
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px]">
                  {p._count.enrolments || "—"}
                </td>
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px]">
                  {formatNaira(p.feeMinor)}
                </td>
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2">
                  <Tag variant={STATUS_TAG_VARIANT[p.status]}>{statusLabel(p.status)}</Tag>
                </td>
                <td className="border-b border-dashed border-neutral-300 py-[10px] pr-[var(--space-4)] text-right">
                  <ProgrammeRowActions
                    id={p.id}
                    code={p.code}
                    title={p.title}
                    status={p.status}
                    isPublished={p.listing?.isPublished}
                    staffRole={currentStaff?.role ?? null}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
