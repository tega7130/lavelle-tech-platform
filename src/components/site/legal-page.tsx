import type { ReactNode } from "react";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-11 pb-[88px]">
        <div className="mx-auto max-w-[760px] px-5 sm:px-6 md:px-8 lg:px-10">
          <h1 className="font-heading font-semibold text-[24px] sm:text-[28px] lg:text-[34px] leading-[1.16] tracking-[-0.02em]">
            {title}
          </h1>
          <div className="text-[13px] text-neutral-500 mt-3">Last updated {lastUpdated}</div>

          <div
            className="mt-9 text-[15.5px] leading-[1.75] text-neutral-800
              [&_h2]:font-heading [&_h2]:font-semibold [&_h2]:text-[19px] [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:tracking-[-0.01em]
              [&_h2:first-child]:mt-0
              [&_h3]:font-heading [&_h3]:font-semibold [&_h3]:text-[15.5px] [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:mt-0 [&_p]:mb-5
              [&_ul]:mb-5 [&_ol]:mb-5 [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-1.5
              [&_ul]:list-disc [&_ol]:list-decimal
              [&_strong]:font-semibold
              [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline"
          >
            {children}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
