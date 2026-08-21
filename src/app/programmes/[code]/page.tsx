import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getListingDetail, getPublishedListings } from "@/lib/website-reads";

// Statically pre-rendered for every published listing (rule 6) — the
// highest-traffic, lowest-personalisation surface in the system.
// revalidatePath in publishListing/unpublishListing keeps this current
// without a deploy.
export async function generateStaticParams() {
  const listings = await getPublishedListings();
  return listings.map((l) => ({ code: l.code }));
}

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getListingDetail(code);
  if (!detail) notFound();

  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-11 pb-[88px]">
        <div className="mx-auto max-w-[1200px] px-10">
          <Link href="/programmes" className="text-[12.5px] text-neutral-600 font-medium no-underline hover:text-accent">
            &larr; All specializations
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_348px] gap-14 items-start mt-[26px]">
            <div>
              <div className="flex items-center gap-[9px] flex-wrap">
                <span className={cn("px-[11px] py-1 rounded-full text-[10px] font-semibold tracking-[0.05em] uppercase", detail.tier === "FOUNDATION" ? "bg-neutral-100 text-neutral-700" : detail.tier === "ADVANCED_PRACTITIONER" ? "bg-accent-2-100 text-accent-2-800" : "bg-accent-100 text-accent-700")}>
                  {detail.tierLabel}
                </span>
                <span className="text-[12px] text-neutral-600">
                  {detail.code} · September 2026 intake
                </span>
              </div>
              <h1 className="font-heading font-semibold text-[38px] leading-[1.12] mt-4 max-w-[22ch] tracking-[-0.022em]">{detail.title}</h1>
              <p className="text-[16px] leading-[1.7] text-neutral-700 mt-[18px] max-w-[60ch]">{detail.pitch}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                {detail.facts.map((f) => (
                  <div key={f.label} className="px-4 py-[15px] rounded-[11px] bg-neutral-100 border border-divider">
                    <div className="text-[9.5px] tracking-[0.1em] uppercase text-neutral-700">{f.label}</div>
                    <div className="font-heading font-semibold text-[15px] mt-[5px]">{f.value}</div>
                  </div>
                ))}
              </div>

              {detail.outcomes.length > 0 && (
                <>
                  <h3 className="font-heading font-semibold text-[21px] mt-11">What you will be able to do</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[13px] mt-[18px]">
                    {detail.outcomes.map((o) => (
                      <div key={o} className="flex gap-[11px] items-start">
                        <span className="w-[19px] h-[19px] flex-none mt-px rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-[10px] font-bold">✓</span>
                        <span className="text-[13.5px] leading-[1.6] text-neutral-700">{o}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h3 className="font-heading font-semibold text-[21px] mt-11">Syllabus</h3>
              <div className="text-[13px] text-neutral-600 mt-[6px]">{detail.syllabusMeta}</div>
              <div className="flex flex-col gap-[10px] mt-[18px]">
                {detail.modules.map((m) => (
                  <details key={m.week} className="rounded-xl border border-divider bg-bg overflow-hidden group">
                    <summary className="flex gap-[18px] px-5 py-[18px] cursor-pointer list-none">
                      <div className="flex-none w-[52px]">
                        <div className="text-[9.5px] tracking-[0.1em] uppercase text-neutral-700">Week</div>
                        <div className="font-heading font-bold text-[19px] text-accent leading-none mt-[3px]">{m.week}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-semibold text-[15px]">{m.title}</div>
                        <div className="text-[12.5px] text-neutral-600 mt-[5px]">
                          {m.lectureCount} lecture{m.lectureCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className="flex-none w-6 h-6 rounded-[7px] border border-neutral-300 flex items-center justify-center text-neutral-700 self-center transition group-open:rotate-180">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 6.5 8 10l3.5-3.5" />
                        </svg>
                      </span>
                    </summary>
                    <div className="px-5 pb-[18px] pl-[89px]">
                      <ul className="m-0 pl-4 flex flex-col gap-[6px]">
                        {m.lectures.map((title, i) => (
                          <li key={i} className="text-[12.5px] leading-[1.5] text-neutral-700">
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ))}
              </div>

              {detail.assessment.length > 0 && (
                <>
                  <h3 className="font-heading font-semibold text-[21px] mt-11">How you are assessed</h3>
                  <div className="flex flex-col gap-[11px] mt-4">
                    {detail.assessment.map((a) => (
                      <div key={a.item} className="flex justify-between gap-5 pb-[11px] border-b border-dashed border-neutral-300">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium">{a.item}</div>
                          <div className="text-[12px] text-neutral-600 mt-[3px]">{a.detail}</div>
                        </div>
                        <div className="flex-none font-heading font-semibold text-[14px]">{a.weight}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* fee panel */}
            <div className="lg:sticky lg:top-8 rounded-2xl overflow-hidden border border-accent-200 shadow-[0_18px_44px_rgba(19,26,46,0.1)] bg-bg">
              <div className="px-[26px] pt-[26px] pb-[22px] bg-[linear-gradient(158deg,#0c356f,#08234a)] text-white">
                <div className="text-[10px] tracking-[0.14em] uppercase text-accent-2">Programme fee</div>
                <div className="font-heading font-bold text-[36px] leading-none mt-[10px]">{detail.fee}</div>
                <div className="text-[12px] text-white/66 mt-2">{detail.feeNote}</div>
              </div>

              <div className="px-[26px] pt-6 pb-[26px]">
                {detail.included.length > 0 && (
                  <div className="flex flex-col gap-[11px]">
                    {detail.included.map((i) => (
                      <div key={i} className="flex gap-[10px] items-start">
                        <span className="w-4 h-4 flex-none mt-[2px] rounded-full bg-accent-2-100 text-accent-2-800 flex items-center justify-center text-[9px] font-bold">✓</span>
                        <span className="text-[12.5px] leading-[1.55] text-neutral-700">{i}</span>
                      </div>
                    ))}
                  </div>
                )}

                {detail.isArchived ? (
                  <>
                    <div className="px-4 py-3 rounded-[9px] bg-neutral-100 border border-divider text-[12.5px] text-neutral-700 leading-relaxed text-center">
                      This programme is not currently open for enrolment.
                    </div>
                    <Link href="/programmes" className={cn(buttonClassName("secondary"), "w-full h-11 mt-[10px] text-[13.5px]")}>
                      Browse open specializations
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/register" className={cn(buttonClassName("primary"), "w-full mt-5 rounded-[9px]")}>
                      Apply for this programme
                    </Link>
                    <Link href="/contact" className={buttonClassName("secondary", "w-full h-11 mt-[10px] text-[13.5px]")}>
                      Speak to a representative
                    </Link>
                    <div className="text-[11px] text-neutral-700 text-center mt-[14px]">Registration is free · you pay only when you enrol</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
