import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function UnsubscribedPage() {
  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-24">
        <div className="mx-auto max-w-[560px] px-5 sm:px-6 md:px-8 text-center">
          <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Notifications</div>
          <h1 className="font-heading font-semibold text-[24px] sm:text-[28px] leading-[1.14] mt-4 tracking-[-0.022em]">You&rsquo;re unsubscribed</h1>
          <p className="text-[15px] leading-[1.72] text-neutral-700 mt-[14px]">
            You won&rsquo;t receive an email when this programme opens for enrolment. You can browse our full catalogue any time.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
