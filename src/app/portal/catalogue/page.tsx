import Link from "next/link";
import { listCatalogue } from "@/lib/catalogue-reads";
import { formatNaira, tierLabel } from "@/lib/format";
import { Card, CardTitle, CardBody, CardMeta } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import type { ProgrammeTier } from "@/generated/prisma/client";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>;
}) {
  const sp = await searchParams;
  const programmes = await listCatalogue({ q: sp.q, tier: sp.tier as ProgrammeTier | undefined });

  const TIERS: { value?: ProgrammeTier; label: string }[] = [
    { value: undefined, label: "All levels" },
    { value: "FOUNDATION", label: "Foundation" },
    { value: "SPECIALIST", label: "Specialist" },
    { value: "ADVANCED_PRACTITIONER", label: "Advanced" },
  ];

  return (
    <div className="max-w-[1180px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Programmes</h1>

      <div className="flex gap-2 flex-wrap mb-[var(--space-6)]">
        {TIERS.map((t) => (
          <Link
            key={t.label}
            href={t.value ? `/portal/catalogue?tier=${t.value}` : "/portal/catalogue"}
            className={buttonClassName(sp.tier === t.value || (!sp.tier && !t.value) ? "primary" : "secondary", "text-xs px-3 py-1.5 h-auto")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {programmes.length === 0 ? (
        <Card elev="sm" className="items-center text-center py-12 px-6">
          <div className="font-heading font-semibold text-[15px]">No programmes match those filters</div>
          <p className="text-neutral-600 text-[12.5px] max-w-[44ch] mx-auto mt-2">
            Widening the filters may return more programmes.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-[var(--space-4)]">
          {programmes.map((p) => (
            <Card key={p.id} elev="sm" className="overflow-hidden">
              <div className="flex gap-1.5 min-w-0">
                <Tag variant="accent" className="flex-none">{tierLabel(p.tier)}</Tag>
                <Tag variant="neutral" className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{p.category.name}</Tag>
              </div>
              <CardTitle className="mt-1.5">{p.title}</CardTitle>
              <CardBody>{p.summary}</CardBody>
              <CardMeta>
                {p.weeks} weeks &middot; {p.credits} credits
              </CardMeta>
              <div className="border-t border-dashed border-neutral-300 my-2" />
              <div className="flex items-center justify-between">
                <span className="font-heading text-[15px]">{formatNaira(p.feeMinor)}</span>
                {p.viewerEnrolled ? (
                  <Link href={`/portal/catalogue/${p.code}`} className={buttonClassName("secondary", "text-xs px-3 py-1.5 h-auto")}>
                    Enrolled
                  </Link>
                ) : (
                  <Link href={`/portal/catalogue/${p.code}`} className={buttonClassName("primary", "text-xs px-3 py-1.5 h-auto")}>
                    View programme
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
