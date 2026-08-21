import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "The ladder", href: "/#ladder" },
  { label: "Programmes", href: "/programmes" },
  { label: "How it works", href: "/#how" },
  { label: "Reviews", href: "/#reviews" },
  { label: "FAQ", href: "/#faq" },
  { label: "Verify", href: "/verify" },
];

// A transparent, white-bordered skin for the dark hero — the shared
// `secondary` variant assumes a light surface, so its bg/border/text are
// overridden here (twMerge in buttonClassName keeps the rest: height,
// padding, radius, font).
const GHOST_ON_DARK = "bg-transparent border-white/28 text-white hover:bg-white/[0.09] hover:text-white h-[42px] px-[17px] text-[13.5px] rounded-[9px]";

export function SiteHeroHeader() {
  return (
    <header className="relative z-10">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between gap-8 px-10 pt-6 pb-6">
        <div className="flex items-center gap-[11px]">
          <LogoMark size={38} />
          <div>
            <div className="font-heading font-bold text-[16px] tracking-[0.02em] text-white">LAVELLE INSTITUTE</div>
            <div className="text-[9.5px] tracking-[0.15em] uppercase text-white/55">Professional Specialization</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-[30px]">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-[13.5px] font-medium text-white/72 hover:text-white no-underline">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-none">
          <Link href="/sign-in" className={buttonClassName("secondary", GHOST_ON_DARK)}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonClassName("primary"), "h-[42px] px-[19px] text-[13.5px] rounded-[9px]")}>
            Apply now
          </Link>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
    </header>
  );
}

/** The compact dark header used on the standalone programme page. */
export function SiteCompactHeader() {
  return (
    <div className="bg-[linear-gradient(158deg,#0c356f_0%,#08234a_60%,#061529_100%)]">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between gap-8 px-10 py-[22px]">
        <Link href="/" className="flex items-center gap-[11px] no-underline">
          <LogoMark size={34} />
          <div>
            <div className="font-heading font-bold text-[15px] tracking-[0.02em] text-white">LAVELLE INSTITUTE</div>
            <div className="text-[9.5px] tracking-[0.15em] uppercase text-white/55">Professional Specialization</div>
          </div>
        </Link>
        <div className="flex items-center gap-3 flex-none">
          <Link href="/programmes" className={buttonClassName("secondary", cn(GHOST_ON_DARK, "h-10 px-4 text-[13px]"))}>
            All specializations
          </Link>
          <Link href="/register" className={cn(buttonClassName("primary"), "h-10 px-[18px] text-[13px] rounded-[9px]")}>
            Apply now
          </Link>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
    </div>
  );
}
