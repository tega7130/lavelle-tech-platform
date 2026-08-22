import Image from "next/image";
import Link from "next/link";
import { SiteHeroHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ContactForm } from "@/components/site/contact-form";
import { ProgrammeCarousel } from "@/components/site/programme-carousel";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getPublishedListings, getPublishedReviews, getPublishedFaqs } from "@/lib/website-reads";

const TIERS = [
  {
    seal: "F", step: "Step one", name: "Foundation",
    border: "border-neutral-300", stripe: "bg-neutral-300", sealBg: "bg-neutral-100", sealColor: "text-neutral-600",
    blurb: "Grounding in a practice area for graduates, new wigs and non-lawyers in regulated industries.",
    facts: [["Length", "8 weeks"], ["Credits", "12"], ["Entry", "Open"]],
  },
  {
    seal: "S", step: "Step two", name: "Specialist",
    border: "border-accent-200", stripe: "bg-gradient-to-r from-accent to-accent-400", sealBg: "bg-accent", sealColor: "text-accent-2",
    blurb: "Applied practice at depth: drafting, transactions and regulatory judgement, marked by faculty.",
    facts: [["Length", "12 weeks"], ["Credits", "24"], ["Entry", "Called to the Bar"]],
  },
  {
    seal: "A", step: "Step three", name: "Advanced Practitioner",
    border: "border-accent-2-300", stripe: "bg-gradient-to-r from-accent-2 to-accent-2-400", sealBg: "bg-accent-2", sealColor: "text-[#08234a]",
    blurb: "Strategy and complex matters at the senior tier, and the route onto the Lavelle faculty register.",
    facts: [["Length", "16 weeks"], ["Credits", "36"], ["Entry", "Specialist credential"]],
  },
] as const;

const STEPS = [
  { n: "01", title: "Register free, with no commitment", body: "Give us your name, email and a password. You receive a provisional applicant number and full access to the catalogue.", note: "No payment details required" },
  { n: "02", title: "Choose a specialization and tier", body: "Browse by practice area and level. Each programme lists its syllabus module by module, its faculty, its intake dates and its fee.", note: null },
  { n: "03", title: "Enrol in a Programme", body: "Choose a programme that fits your goals and complete your enrolment. Once you're enrolled, you'll get access to your learning materials and receive your Candidate ID card.", note: null },
  { n: "04", title: "Learn, practise and be assessed", body: "Recorded lectures with narration, applied scenarios, drafting exercises marked by faculty, and a quiz at the close of every module.", note: null },
  { n: "05", title: "Sit the certifying examination", body: "A proctored paper of objective and written questions. Pass it and your certificate is issued, verifiable publicly the same day.", note: "Certificates carry a Lavelle pathway mark" },
] as const;

const FACULTY = [
  { name: "Dr Nkechi Balogun", role: "Director of Studies · Energy", bio: "Twenty-two years in upstream advisory work; sits on two industry arbitration panels." },
  { name: "Adaeze Eze SAN", role: "Faculty lead · Tax & Revenue", bio: "Revenue litigator and author of the Institute's assessment-dispute casebook." },
  { name: "Olumide Adeyemi", role: "Faculty lead · Maritime", bio: "Admiralty practitioner; formerly counsel to a West African terminal operator." },
] as const;

const FIRMS = ["Aluko & Oyebode", "Templars", "Banwo & Ighodalo", "Sterling Bank", "NNPC Ltd", "Olaniwun Ajayi"];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

export default async function HomePage() {
  const [listings, reviews, faqs] = await Promise.all([getPublishedListings(), getPublishedReviews(), getPublishedFaqs()]);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "5.0";
  const featuredQuote = reviews[0];

  return (
    <div id="top" className="bg-bg">
      {/* HEADER + HERO */}
      <div className="relative overflow-hidden bg-[linear-gradient(158deg,#0c356f_0%,#08234a_46%,#061529_100%)]">
        <div className="pointer-events-none absolute -top-[220px] -right-[140px] w-[640px] h-[640px] rounded-full bg-[radial-gradient(circle,rgba(22,104,227,0.5),rgba(22,104,227,0)_68%)]" />
        <div className="pointer-events-none absolute -bottom-[160px] -left-[120px] w-[460px] h-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,198,41,0.14),rgba(255,198,41,0)_70%)]" />

        <SiteHeroHeader />

        <div className="relative z-[2] mx-auto max-w-[1200px] px-10 pt-[70px] pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-[72px] items-center">
            <div>
              <h1 className="font-heading font-semibold text-[58px] leading-[1.05] text-white mt-[26px] max-w-[16ch] tracking-[-0.022em]">
                Lavelle transforms lawyers into recognised specialists
              </h1>

              <p className="text-[16.5px] leading-[1.68] text-white/74 max-w-[52ch] mt-[22px]">
                Build a reputation for expertise. Specialise in the areas of law shaping the future, learn from leading practitioners, and earn verifiable credentials that distinguish you in the legal profession.
              </p>

              <div className="flex gap-[13px] mt-[34px] flex-wrap">
                <Link href="/programmes" className={cn(buttonClassName("primary"), "h-[50px] px-6 rounded-[9px] text-[14.5px]")}>
                  Start your specialisation
                </Link>
                <Link
                  href="/verify"
                  className={buttonClassName("secondary", "bg-transparent border-white/28 text-white hover:bg-white/[0.09] hover:text-white h-[50px] px-6 rounded-[9px] text-[14.5px]")}
                >
                  Verify a credential
                </Link>
              </div>

              <div className="flex gap-10 mt-[52px] pt-[30px] border-t border-dashed border-white/20 flex-wrap">
                {[
                  ["1,240+", "Practitioners credentialed since 2023"],
                  ["11", "Specializations across three tiers"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="font-heading font-bold text-[30px] leading-none text-accent-2">{value}</div>
                    <div className="text-[11.5px] leading-[1.5] text-white/58 mt-[7px] max-w-[20ch]">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block relative">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/5] shadow-[0_30px_70px_rgba(0,0,0,0.42)] bg-[#061529]">
                <Image
                  src="/images/practitioner-portrait.jpg"
                  alt="A Lavelle-credentialed practitioner"
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 0px"
                  className="object-cover object-[84%_center]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#061529]/10 via-transparent to-[#061529]/82" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
              </div>
              <div className="absolute -left-7 bottom-11 w-[250px] p-[17px] rounded-[13px] bg-white/97 shadow-[0_22px_48px_rgba(0,0,0,0.34)] backdrop-blur">
                <div className="flex items-center gap-[9px]">
                  <span className="w-[26px] h-[26px] flex-none rounded-full bg-accent text-accent-900 flex items-center justify-center text-[12px] font-bold">✓</span>
                  <div className="font-heading font-semibold text-[12.5px] text-[#131a2e]">Credential verified</div>
                </div>
                <div className="text-[11px] text-neutral-600 leading-[1.5] mt-[9px]">
                  LVL-CERT-2026-01188 · Specialist, Energy Law &amp; Regulation · issued 4 Aug 2026
                </div>
                <div className="h-px border-t border-dashed border-neutral-300 my-[11px]" />
                <div className="text-[10px] text-neutral-500">Checkable by any employer at lavelle.africa/verify</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TRUST STRIP */}
      <div className="border-b border-divider bg-neutral-100">
        <div className="mx-auto max-w-[1200px] px-10 py-[26px] flex items-center justify-between gap-9 flex-wrap">
          <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-neutral-700">Candidates practise at</div>
          <div className="flex items-center gap-[34px] flex-wrap">
            {FIRMS.map((f) => (
              <div key={f} className="font-heading font-semibold text-[14px] text-neutral-600 tracking-[0.01em]">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* THE LADDER */}
      <div id="ladder" className="py-[104px]">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="max-w-[660px]">
            <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">The credentialing ladder</div>
            <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">A title you earn, not a certificate you collect.</h2>
            <p className="text-[15.5px] leading-[1.7] text-neutral-600 mt-[18px]">
              At Lavelle, candidates are challenged to put their knowledge into practice, sharpen their work through feedback from practising legal professionals, and demonstrate their competence through rigorous assessment. Each level takes you further, building deeper expertise, stronger credibility, and a professional distinction earned through demonstrated capability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {TIERS.map((t) => (
              <div key={t.name} className={cn("relative rounded-[14px] overflow-hidden bg-bg border transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)]", t.border)}>
                <div className={cn("h-1", t.stripe)} />
                <div className="p-[30px] pb-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className={cn("w-[46px] h-[46px] flex-none rounded-xl flex items-center justify-center font-heading font-bold text-[18px]", t.sealBg, t.sealColor)}>{t.seal}</span>
                    <span className="flex-none px-[10px] py-1 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold tracking-[0.06em] uppercase">{t.step}</span>
                  </div>
                  <h3 className="font-heading font-semibold text-[21px] mt-[22px]">{t.name}</h3>
                  <p className="text-[13.5px] leading-[1.65] text-neutral-600 mt-[10px] min-h-[66px]">{t.blurb}</p>
                  <div className="flex flex-col gap-[9px] mt-5 pt-[18px] border-t border-dashed border-neutral-300">
                    {t.facts.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-[14px] text-[12.5px]">
                        <span className="text-neutral-600">{label}</span>
                        <span className="font-medium text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SPECIALIZATIONS */}
      <div id="programmes" className="py-[104px] bg-neutral-100 border-t border-b border-divider">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="flex items-end justify-between gap-10 flex-wrap">
            <div className="max-w-[600px]">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Specializations</div>
              <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">Pick the sector your next brief comes from.</h2>
            </div>
            <p className="text-[14.5px] leading-[1.7] text-neutral-600 max-w-[44ch]">
              Our programmes go beyond theory to develop the practical knowledge, skills and judgement required in today's legal landscape. Explore each programme to discover what you'll learn.
            </p>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-16 mt-11 border border-divider rounded-[14px] bg-bg">
              <div className="font-heading font-semibold text-[16px]">Programmes are being prepared</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
                Nothing is published yet. Check back shortly, or leave your details below and we will let you know the moment the catalogue opens.
              </p>
            </div>
          ) : (
            <>
              <ProgrammeCarousel listings={listings} />
              <div className="flex justify-center mt-8">
                <Link href="/programmes" className={cn(buttonClassName("secondary"), "h-11 px-6 text-[13.5px]")}>
                  View all programmes &rarr;
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" className="py-[104px]">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-[72px] items-start">
            <div className="lg:sticky lg:top-10">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">How it works</div>
              <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">Enrol, study, sit, be credentialed.</h2>
              <p className="text-[15px] leading-[1.7] text-neutral-600 mt-[18px]">Registration is free and commits you to nothing. You pay per programme, when you are ready.</p>
              <Link href="/register" className={cn(buttonClassName("primary"), "h-[50px] px-6 rounded-[9px] text-[14.5px] mt-7")}>
                Create your account
              </Link>
              <div className="text-[11.5px] text-neutral-600 mt-[14px]">Takes about a minute · no payment details required</div>
            </div>

            <div className="flex flex-col">
              {STEPS.map((st) => (
                <div key={st.n} className="flex gap-6 py-[26px] border-b border-dashed border-neutral-300">
                  <div className="flex-none w-11">
                    <div className="font-heading font-bold text-[13px] text-accent tracking-[0.04em]">{st.n}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-[18px]">{st.title}</h3>
                    <p className="text-[13.5px] leading-[1.68] text-neutral-600 mt-2">{st.body}</p>
                    {st.note && (
                      <div className="inline-block mt-3 px-[11px] py-[5px] rounded-md bg-accent-100 text-accent-800 text-[11.5px] font-medium">{st.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VERIFICATION */}
      <div className="py-24 bg-[linear-gradient(158deg,#0c356f,#08234a)] relative overflow-hidden">
        <div className="pointer-events-none absolute -top-[180px] -left-[120px] w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,198,41,0.13),rgba(255,198,41,0)_70%)]" />
        <div className="relative mx-auto max-w-[1200px] px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[72px] items-center">
            <div>
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent-2">Public verification</div>
              <h2 className="font-heading font-semibold text-[38px] leading-[1.14] text-white mt-4 tracking-[-0.022em]">A credential anyone can check in seconds.</h2>
              <p className="text-[15px] leading-[1.72] text-white/72 mt-[18px] max-w-[46ch]">
                Every certificate carries an identifier and a QR code. Employers, clients and regulators can confirm the holder, the tier, the grade and the issue date, and see immediately if a credential has been revoked.
              </p>
              <Link href="/verify" className={cn(buttonClassName("primary"), "h-[50px] px-6 rounded-[9px] text-[14.5px] mt-7")}>
                Open the verification portal
              </Link>
            </div>

            <div className="bg-white/[0.06] border border-white/[0.16] rounded-[15px] p-[26px] backdrop-blur-sm">
              <div className="text-[10.5px] tracking-[0.12em] uppercase text-white/50">Certificate identifier</div>
              <div className="flex gap-[10px] mt-[11px]">
                <div className="flex-1 h-11 rounded-lg bg-white/10 border border-white/20 flex items-center px-[14px] text-[13.5px] text-white tabular-nums">
                  LVL-CERT-2026-01188
                </div>
                <div className="flex-none w-11 h-11 rounded-lg bg-accent-2 flex items-center justify-center text-[#08234a] text-[17px] font-bold">&rarr;</div>
              </div>
              <div className="mt-5 pt-[18px] border-t border-dashed border-white/20 flex flex-col gap-[13px]">
                {[
                  ["Holder", "Chiamaka Okonji"],
                  ["Programme", "Energy Law & Regulation"],
                  ["Tier & grade", "Specialist · Merit"],
                  ["Issued", "4 August 2026"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-[12px] text-white/50">{label}</span>
                    <span className="text-[12.5px] text-white font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 mt-5 px-[13px] py-[7px] rounded-full bg-[#86efac]/[0.14] border border-[#86efac]/40">
                <span className="w-[15px] h-[15px] flex-none rounded-full bg-[#86efac] text-[#08234a] flex items-center justify-center text-[9px] font-bold">✓</span>
                <span className="text-[11.5px] font-semibold text-[#bbf7d0]">Valid and in good standing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FACULTY */}
      <div id="faculty" className="py-[104px] hidden">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="max-w-[620px]">
            <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Faculty</div>
            <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">Taught by people who do the work.</h2>
            <p className="text-[15.5px] leading-[1.7] text-neutral-600 mt-[18px]">
              Our faculty are senior practitioners and regulators. They author the material, set the papers, and mark the drafting themselves.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-11">
            {FACULTY.map((f) => (
              <div key={f.name} className="border border-divider rounded-[14px] overflow-hidden bg-bg transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)]">
                <div className="relative aspect-[5/4] bg-neutral-100 flex items-center justify-center">
                  <span className="text-neutral-400 text-[12px]">{f.name}</span>
                </div>
                <div className="p-[22px] pb-6">
                  <h3 className="font-heading font-semibold text-[17px]">{f.name}</h3>
                  <div className="text-[12px] text-accent font-medium mt-[5px]">{f.role}</div>
                  <p className="text-[12.5px] leading-[1.62] text-neutral-600 mt-[11px]">{f.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REVIEWS */}
      <div id="reviews" className="py-[100px] bg-neutral-100 border-t border-b border-divider">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="flex items-end justify-between gap-10 flex-wrap">
            <div className="max-w-[600px]">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">What candidates say</div>
              <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">The work speaks for itself.</h2>
            </div>
            <div className="flex items-center gap-5">
              <div>
                <div className="flex items-baseline gap-[7px]">
                  <span className="font-heading font-bold text-[34px] leading-none">{avgRating}</span>
                  <span className="text-[13px] text-neutral-700">/ 5</span>
                </div>
                <div className="flex gap-[2px] mt-[6px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="text-accent-2-500 text-[14px]">★</span>
                  ))}
                </div>
              </div>
              <div className="w-px h-11 bg-neutral-300" />
              <div className="text-[12.5px] leading-[1.6] text-neutral-700 max-w-[20ch]">{reviews.length} verified candidate reviews</div>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-16 mt-11 border border-divider rounded-[16px] bg-bg">
              <div className="font-heading font-semibold text-[16px]">No reviews yet</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">
                Candidate reviews appear here as they come in. Be among the first to earn a credential and share your experience.
              </p>
            </div>
          ) : (
            <>
              {featuredQuote && (
                <div className="rounded-2xl p-10 mt-11 bg-[linear-gradient(158deg,#0c356f,#08234a)] text-white relative overflow-hidden">
                  <div className="pointer-events-none absolute -top-[120px] -right-[90px] w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,198,41,0.13),rgba(255,198,41,0)_70%)]" />
                  <div className="relative max-w-[74ch]">
                    <div className="font-heading font-bold text-[40px] text-accent-2 leading-none">&ldquo;</div>
                    <p className="font-heading font-medium text-[23px] leading-[1.5] tracking-[-0.015em] mt-[6px]">{featuredQuote.quote}</p>
                    <div className="flex items-center gap-[13px] mt-7 pt-[22px] border-t border-dashed border-white/22">
                      <span className="w-11 h-11 flex-none rounded-full bg-accent-2/[0.16] border border-accent-2/[0.38] text-accent-2-300 flex items-center justify-center font-heading text-[13px] font-semibold">
                        {initials(featuredQuote.authorName)}
                      </span>
                      <div>
                        <div className="font-heading font-semibold text-[14px]">{featuredQuote.authorName}</div>
                        <div className="text-[12px] text-white/66">{featuredQuote.authorTitle}</div>
                      </div>
                      {featuredQuote.tierLabel && (
                        <span className="ml-auto px-[11px] py-1 rounded-full bg-accent-2/[0.14] border border-accent-2/40 text-accent-2-300 text-[10.5px] font-semibold tracking-[0.05em] uppercase">
                          {featuredQuote.tierLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-bg border border-divider rounded-[14px] p-6 flex flex-col transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)]">
                    <div className="flex gap-[2px]">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <span key={i} className="text-accent-2-500 text-[12.5px]">★</span>
                      ))}
                    </div>
                    <p className="text-[13px] leading-[1.65] text-neutral-700 mt-[9px] flex-1">{r.quote}</p>
                    <div className="flex items-center gap-[11px] mt-5 pt-4 border-t border-dashed border-neutral-300">
                      <span className="w-8 h-8 flex-none rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-heading text-[11px] font-semibold">
                        {initials(r.authorName)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium">{r.authorName}</div>
                        <div className="text-[11px] text-neutral-700">{r.authorTitle}</div>
                      </div>
                    </div>
                    {r.programmeTitle && (
                      <div className="flex items-center gap-[6px] mt-3">
                        <span className="text-accent text-[11px]">✓</span>
                        <span className="text-[10.5px] text-neutral-700">
                          {r.programmeTitle} · {r.tierLabel}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="py-[104px]">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[72px] items-start">
            <div className="lg:sticky lg:top-10">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Questions</div>
              <h2 className="font-heading font-semibold text-[40px] leading-[1.14] mt-4 tracking-[-0.022em]">Straight answers.</h2>
              <p className="text-[15px] leading-[1.7] text-neutral-600 mt-[18px] max-w-[38ch]">If yours is not here, a representative will answer it directly, usually the same day.</p>
              <Link href="#contact" className={buttonClassName("secondary", "h-11 text-[13.5px] mt-[26px]")}>
                Ask us anything
              </Link>
            </div>

            <div className="flex flex-col gap-[10px]">
              {faqs.map((q, i) => (
                <details key={q.id} className="group border border-divider rounded-xl bg-bg overflow-hidden open:border-accent-200 open:bg-accent-100" open={i === 0}>
                  <summary className="flex items-start gap-4 px-[22px] py-5 cursor-pointer list-none">
                    <span className="flex-1 min-w-0 font-heading font-semibold text-[15px] leading-[1.45]">{q.question}</span>
                    <span className="w-6 h-6 flex-none rounded-[7px] border border-neutral-300 flex items-center justify-center text-neutral-700 transition group-open:rotate-180">
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 6.5 8 10l3.5-3.5" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-[60px] pb-[22px] pl-[22px]">
                    <p className="text-[13.5px] leading-[1.72] text-neutral-700 m-0">{q.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="py-[104px]">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(158deg,#0c356f,#08234a)] px-14 py-16 text-center">
            <div className="pointer-events-none absolute -top-40 -right-[100px] w-[460px] h-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,198,41,0.16),rgba(255,198,41,0)_70%)]" />
            <div className="relative">
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent-2">September 2026 intake</div>
              <h2 className="font-heading font-semibold text-[42px] leading-[1.12] text-white mt-4 max-w-[22ch] mx-auto tracking-[-0.022em]">
                Registration closes 31 August.
              </h2>
              <p className="text-[15.5px] leading-[1.7] text-white/72 max-w-[52ch] mx-auto mt-[18px]">
                Create your account today, browse the catalogue at your own pace, and enrol when the right programme is in front of you.
              </p>
              <div className="flex gap-[13px] justify-center mt-[34px] flex-wrap">
                <Link href="/register" className={cn(buttonClassName("primary"), "h-[50px] px-6 rounded-[9px] text-[14.5px]")}>
                  Create your account
                </Link>
                <Link
                  href="#programmes"
                  className={buttonClassName("secondary", "bg-transparent border-white/28 text-white hover:bg-white/[0.09] hover:text-white h-[50px] px-6 rounded-[9px] text-[14.5px]")}
                >
                  See the catalogue
                </Link>
              </div>
              <div className="flex gap-7 justify-center mt-[34px] flex-wrap text-[11.5px] text-white/50">
                <span>Registration is free</span>
                <span>Pay per programme</span>
                <span>Credentials verifiable for life</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <div id="contact" className="py-24 bg-neutral-100 border-t border-divider">
        <div className="mx-auto max-w-[1200px] px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-16 items-start">
            <div>
              <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Talk to us first</div>
              <h2 className="font-heading font-semibold text-[38px] leading-[1.14] mt-4 tracking-[-0.022em]">Not sure which tier fits you?</h2>
              <p className="text-[15px] leading-[1.72] text-neutral-700 mt-[18px] max-w-[44ch]">
                Tell us where you are in practice and what you want to be known for. A representative will come back with a straight recommendation, not a sales call.
              </p>
              <div className="flex flex-col gap-4 mt-8 pt-[26px] border-t border-dashed border-neutral-300">
                {[
                  ["@", "candidates@lavelle.ng", "Enrolment, programmes and fees"],
                  ["☎", "+234 700 528 3553", "Monday to Friday, 9am – 5pm WAT"],
                  ["W", "+234 803 552 8841", "WhatsApp: a representative, not a bot"],
                ].map(([mark, value, meta]) => (
                  <div key={value} className="flex gap-[13px] items-start">
                    <span className="w-[34px] h-[34px] flex-none rounded-[9px] bg-accent-100 text-accent-700 flex items-center justify-center text-[13px] font-semibold">{mark}</span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium">{value}</div>
                      <div className="text-[11.5px] text-neutral-700 mt-[2px]">{meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative bg-bg border border-divider rounded-2xl p-[30px] shadow-[0_14px_36px_rgba(19,26,46,0.07)]">
              <ContactForm listings={listings.map((l) => ({ code: l.code, title: l.title }))} />
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
