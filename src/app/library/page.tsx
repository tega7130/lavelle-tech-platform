import Link from "next/link";
import type { Metadata } from "next";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LibraryCatalogue } from "@/components/site/library-catalogue";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getPublicDocumentTemplates, getPublicDocumentCategories, getActiveLibraryPromotion } from "@/lib/public-document-library-reads";

const SITE_URL = "https://lavelle.africa";
const PAGE_TITLE = "Document Library — Professional Legal Templates | Lavelle Institute";
const PAGE_DESCRIPTION =
  "Browse professional contracts, MOUs, agreements and other legal templates drafted by Nigerian legal experts. Create a free Lavelle account to purchase and download.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/library` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/library`,
    siteName: "Lavelle Institute",
    type: "website",
  },
};

const BENEFITS = [
  { label: "PDF & Word Formats", detail: "Every template ships as an editable .docx or ready-to-use PDF." },
  { label: "Lifetime Access", detail: "Buy once — unlimited downloads, forever, no expiry." },
  { label: "Expert-Curated", detail: "Drafted by Nigerian legal experts for real practice." },
  { label: "Affordable & Instant", detail: "Pay by card, transfer or USSD and download immediately." },
] as const;

const FAQS = [
  { q: "What file formats are available?", a: "PDF and Word (.docx)." },
  { q: "Can I download templates multiple times?", a: "Yes. Purchased templates have unlimited downloads." },
  { q: "How long do I have access?", a: "Forever, with no expiration." },
  { q: "What payment methods do you accept?", a: "Card, transfer or USSD." },
  { q: "Are the templates legally reviewed?", a: "Templates are drafted by Nigerian legal experts." },
  { q: "Can I modify the templates?", a: "Templates are editable where the purchased file format supports editing — Word (.docx) templates can be edited directly; PDF templates can be edited with standard PDF tools." },
  {
    q: "What's the refund policy?",
    a: "Our refund policy is being finalised. If you have a question about a specific purchase, contact us at candidates@lavelle.ng.",
  },
] as const;

export default async function PublicLibraryPage() {
  const [documents, categories, promotion] = await Promise.all([
    getPublicDocumentTemplates(),
    getPublicDocumentCategories(),
    getActiveLibraryPromotion(),
  ]);

  const templateCount = documents.length;
  const faqsWithCount = [
    ...FAQS,
    {
      q: "How many templates are available?",
      a: templateCount > 0 ? `${templateCount} template${templateCount === 1 ? "" : "s"} are currently available in the Library, and growing.` : "New templates are being added to the Library regularly.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsWithCount.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="bg-bg">
      <SiteCompactHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* HERO */}
      <div className="py-11">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10">
          <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Document Library</div>
          <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] lg:text-[40px] leading-[1.12] mt-4 max-w-[26ch] tracking-[-0.022em]">
            Professional document templates for every occasion
          </h1>
          <p className="text-[15px] leading-[1.7] text-neutral-600 mt-[14px] max-w-[62ch]">
            Browse our collection of professional contracts, MOUs, agreements and other legal templates, drafted by Nigerian legal experts. Create a free
            account to access, purchase and download templates.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link href="/register" className={cn(buttonClassName("primary"), "h-[46px] px-6 rounded-[9px] text-[13.5px]")}>
              Create free account
            </Link>
            <Link href="/sign-in?next=/portal/library" className={cn(buttonClassName("secondary"), "h-[46px] px-6 rounded-[9px] text-[13.5px]")}>
              Already have an account? Log in
            </Link>
          </div>

          {/* BENEFITS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mt-11">
            <div className="px-4 py-[18px] rounded-[11px] bg-neutral-100 border border-divider">
              <div className="font-heading font-semibold text-[15px]">{templateCount} Professional Template{templateCount === 1 ? "" : "s"}</div>
              <div className="text-[12px] text-neutral-600 mt-1.5 leading-[1.5]">Curated across contracts, MOUs, agreements and more.</div>
            </div>
            {BENEFITS.map((b) => (
              <div key={b.label} className="px-4 py-[18px] rounded-[11px] bg-neutral-100 border border-divider">
                <div className="font-heading font-semibold text-[15px]">{b.label}</div>
                <div className="text-[12px] text-neutral-600 mt-1.5 leading-[1.5]">{b.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PROMOTIONAL BANNER — only rendered when a discount code is actually active/eligible */}
      {promotion && (
        <div className="bg-[linear-gradient(90deg,#0c356f,#08234a)]">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10 py-3 flex items-center justify-center gap-3 flex-wrap text-center">
            <span className="text-[13px] text-white font-medium">{promotion.headline}</span>
            <Link href="/register" className="text-[12.5px] font-semibold text-accent-2 hover:underline">
              Sign up now &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* CATALOGUE */}
      <div className="py-11 pb-[88px] border-t border-divider">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10">
          {templateCount === 0 ? (
            <div className="text-center py-16 border border-divider rounded-[14px] bg-neutral-100">
              <div className="font-heading font-semibold text-[16px]">The Library is being prepared</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
                Nothing is listed yet. Check back shortly, or create a free account and we&apos;ll let you know the moment templates go live.
              </p>
            </div>
          ) : (
            <LibraryCatalogue documents={documents} categories={categories} />
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="py-[88px] bg-neutral-100 border-t border-divider">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[72px] items-start">
            <div className="lg:sticky lg:top-10">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Questions</div>
              <h2 className="font-heading font-semibold text-[26px] sm:text-[30px] leading-[1.14] mt-4 tracking-[-0.022em]">About the Library.</h2>
            </div>

            <div className="flex flex-col gap-[10px]">
              {faqsWithCount.map((f, i) => (
                <details key={f.q} className="group border border-divider rounded-xl bg-bg overflow-hidden open:border-accent-200 open:bg-accent-100" open={i === 0}>
                  <summary className="flex items-start gap-4 px-[22px] py-5 cursor-pointer list-none">
                    <span className="flex-1 min-w-0 font-heading font-semibold text-[15px] leading-[1.45]">{f.q}</span>
                    <span className="w-6 h-6 flex-none rounded-[7px] border border-neutral-300 flex items-center justify-center text-neutral-700 transition group-open:rotate-180">
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 6.5 8 10l3.5-3.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-[22px] sm:pr-[60px] pb-[22px]">
                    <p className="text-[13.5px] leading-[1.72] text-neutral-700 m-0">{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
