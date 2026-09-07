"use client";

import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PublicDocumentSummary } from "@/lib/public-document-library-reads";

/**
 * The public preview modal — this doubles as the spec's "sign-up redirect
 * modal" (section 17): rather than stacking a second modal on top of this
 * one for a restricted action, the sign-up prompt is a permanent part of
 * this modal's footer. There is nothing else here to gate: no download,
 * no view-online, no document preview, no uploaded date, no purchase
 * count/ratings — only what a public visitor is allowed to see (title,
 * category, description, price, file format) plus complementary
 * templates and the two paths forward (register or sign in).
 */
export function LibraryTemplateModal({
  document,
  complementary,
  onClose,
  onSelectComplementary,
}: {
  document: PublicDocumentSummary;
  complementary: PublicDocumentSummary[];
  onClose: () => void;
  onSelectComplementary: (id: string) => void;
}) {
  return (
    <Dialog open onClose={onClose} className="w-[min(560px,100%)]">
      <div className="flex flex-col gap-1">
        <Tag variant="accent" className="self-start">
          {document.category.name}
        </Tag>
        <h2 className="font-heading font-semibold text-[21px] leading-[1.25] mt-2">{document.title}</h2>
        <p className="text-[13.5px] leading-[1.65] text-neutral-700 mt-2">{document.description || "A professionally drafted template, ready to customise for your matter."}</p>

        <div className="flex items-center gap-5 mt-4 pt-4 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-500">Price</div>
            <div className="flex items-baseline gap-2 mt-1">
              {document.discountedPriceMinor != null && document.discountedPriceMinor < document.priceMinor && (
                <span className="text-[13px] text-neutral-500 line-through">{formatNaira(document.priceMinor)}</span>
              )}
              <span className="font-heading font-semibold text-[19px]">{formatNaira(document.effectivePriceMinor)}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-500">Format</div>
            <div className="font-heading font-semibold text-[15px] mt-1">{document.fileFormat}</div>
          </div>
        </div>

        {complementary.length > 0 && (
          <div className="mt-5 pt-4 border-t border-dashed border-neutral-300">
            <div className="text-[11px] tracking-[0.08em] uppercase font-semibold text-neutral-600">Related templates</div>
            <div className="flex flex-col gap-2 mt-2.5">
              {complementary.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectComplementary(c.id)}
                  className="flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-md border border-divider bg-bg hover:border-accent-200 hover:bg-accent-100 transition cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium truncate">{c.title}</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">{c.category.name}</span>
                  </span>
                  <span className="flex-none text-neutral-400 text-[14px]">&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-divider rounded-md bg-accent-100 -mx-6 -mb-6 px-6 pb-6 pt-5">
          <div className="font-heading font-semibold text-[15px]">Sign up to download</div>
          <p className="text-[12.5px] leading-[1.6] text-neutral-700 mt-1.5">
            Create a free Lavelle account to purchase and download this template.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
            <Link href="/register" className={cn(buttonClassName("primary"), "h-11 flex-1 justify-center text-[13.5px]")}>
              Create free account
            </Link>
            <Link href="/sign-in?next=/portal/library" className={cn(buttonClassName("secondary"), "h-11 flex-1 justify-center text-[13.5px]")}>
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
