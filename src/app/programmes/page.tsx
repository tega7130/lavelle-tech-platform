import type { Metadata } from "next";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ProgrammeCatalogue } from "@/components/site/programme-catalogue";
import { getPublishedListings } from "@/lib/website-reads";
import { SITE_URL } from "@/lib/site-url";

const PAGE_TITLE = "All Programmes — Specializations | Lavelle Institute";
const PAGE_DESCRIPTION =
  "Browse every Lavelle Institute specialization currently open for enrolment across Foundation, Specialist and Advanced Practitioner tiers.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/programmes` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/programmes`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default async function ProgrammesPage() {
  const listings = await getPublishedListings();

  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-11 pb-[88px]">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10">
          <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Specializations</div>
          <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.12] mt-4 max-w-[22ch] tracking-[-0.022em]">All programmes</h1>
          <p className="text-[15px] leading-[1.7] text-neutral-600 mt-[14px] max-w-[60ch]">
            Every specialization currently open for enrolment. Filter by tier or search by name to find the programme that fits where you are in practice.
          </p>

          {listings.length === 0 ? (
            <div className="text-center py-16 mt-11 border border-divider rounded-[14px] bg-neutral-100">
              <div className="font-heading font-semibold text-[16px]">Programmes are being prepared</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
                Nothing is published yet. Check back shortly, or leave your details on our contact page and we will let you know the moment the catalogue opens.
              </p>
            </div>
          ) : (
            <div className="mt-11">
              <ProgrammeCatalogue listings={listings} />
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
