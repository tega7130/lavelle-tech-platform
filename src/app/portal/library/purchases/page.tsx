import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { listCandidatePurchases } from "@/lib/candidate-document-reads";
import { documentCategoryLabel } from "@/lib/document-library";
import { PurchasesFiltersBar } from "@/components/portal/purchases-filters-bar";
import { FavoriteButton } from "@/components/portal/favorite-button";
import { DownloadButton, ViewOnlineButton } from "@/components/portal/document-file-buttons";

function formatDateTime(d: Date) {
  const date = new Date(d);
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function MyPurchasesPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const purchases = await listCandidatePurchases({ q: sp.q, sort: sp.sort === "title" ? "title" : "date" });

  if (purchases.length === 0 && !sp.q) {
    return (
      <div className="max-w-[820px]">
        <Card elev="sm" className="items-center px-6 py-12 text-center">
          <div className="font-heading font-semibold text-[15px]">You haven&apos;t purchased any templates yet.</div>
          <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] text-neutral-600">
            Browse the library to find professional templates that may be useful to you.
          </p>
          <Link href="/portal/library/templates" className={buttonClassName("primary", "mt-4")}>
            Browse Library
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[980px]">
      <PurchasesFiltersBar q={sp.q ?? ""} sort={sp.sort ?? "date"} />

      {purchases.length === 0 ? (
        <Card elev="sm" className="items-center px-6 py-12 text-center">
          <div className="font-heading font-semibold text-[15px]">No purchases match your search</div>
          <p className="mx-auto mt-2 max-w-[44ch] text-[12.5px] text-neutral-600">Try a different search term.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border border-divider">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Template</Th>
                <Th>Category</Th>
                <Th>Purchased</Th>
                <Th />
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {purchases.map((p) => (
                <Tr key={p.id}>
                  <Td className="pl-[var(--space-4)]">
                    <div className="text-[13px]">{p.documentTemplate.title}</div>
                    {!p.documentTemplate.isActive && (
                      <Tag variant="neutral" className="mt-1">
                        No longer listed
                      </Tag>
                    )}
                  </Td>
                  <Td className="text-[13px]">{documentCategoryLabel(p.documentTemplate.category)}</Td>
                  <Td className="text-[13px] tabular-nums">{formatDateTime(p.purchasedAt!)}</Td>
                  <Td>
                    <FavoriteButton documentTemplateId={p.documentTemplate.id} initialFavorited={p.viewerFavorited} className="h-8 w-8" />
                  </Td>
                  <Td className="pr-[var(--space-4)] text-right">
                    <div className="flex justify-end gap-2">
                      <DownloadButton documentTemplateId={p.documentTemplate.id} variant="secondary" className="h-8 px-3 text-xs" />
                      <ViewOnlineButton documentTemplateId={p.documentTemplate.id} variant="secondary" className="h-8 px-3 text-xs" />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
