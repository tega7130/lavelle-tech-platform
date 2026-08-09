import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ContactForm } from "@/components/site/contact-form";
import { getPublishedListings } from "@/lib/website-reads";

export default async function ContactPage() {
  const listings = await getPublishedListings();

  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-16">
        <div className="mx-auto max-w-[640px] px-10">
          <div className="text-center mb-10">
            <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Talk to us first</div>
            <h1 className="font-heading font-semibold text-[34px] leading-[1.14] mt-4 tracking-[-0.022em]">Not sure which tier fits you?</h1>
            <p className="text-[15px] leading-[1.72] text-neutral-700 mt-[14px]">
              Tell us where you are in practice and what you want to be known for. A representative will come back with a straight recommendation, not a sales call.
            </p>
          </div>

          <div className="relative bg-bg border border-divider rounded-2xl p-[30px] shadow-[0_14px_36px_rgba(19,26,46,0.07)]">
            <ContactForm listings={listings.map((l) => ({ code: l.code, title: l.title }))} />
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
