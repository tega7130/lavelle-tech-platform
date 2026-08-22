import Link from "next/link";
import { LogoMark } from "@/components/ui/logo-mark";

const FOOTER_COLS = [
  {
    heading: "Ladder",
    links: [
      { label: "Foundation", href: "/#ladder" },
      { label: "Specialist", href: "/#ladder" },
      { label: "Advanced Practitioner", href: "/#ladder" },
    ],
  },
  {
    heading: "The Institute",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Faculty", href: "/#faculty" },
      { label: "Specializations", href: "/#programmes" },
      { label: "Public verification", href: "/verify" },
    ],
  },
  {
    heading: "Candidates",
    links: [
      { label: "Create an account", href: "/register" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Verify a credential", href: "/verify" },
      { label: "Contact a representative", href: "mailto:candidates@lavelle.ng" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-divider bg-neutral-100">
      <div className="mx-auto max-w-[1200px] px-10 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] gap-14">
          <div>
            <div className="flex items-center gap-[11px]">
              <LogoMark size={34} />
              <div>
                <div className="font-heading font-bold text-[15px] tracking-[0.02em]">LAVELLE INSTITUTE</div>
                <div className="text-[9.5px] tracking-[0.14em] uppercase text-neutral-700">Professional Specialization</div>
              </div>
            </div>
            <p className="text-[12.5px] leading-[1.7] text-neutral-600 mt-[18px] max-w-[34ch]">
              Structured specialization and examined credentialing for the Nigerian legal market. Lagos, Nigeria.
            </p>
            <div className="flex flex-col gap-[5px] mt-[18px] text-[12.5px]">
              <a href="mailto:candidates@lavelle.ng" className="text-accent no-underline hover:underline">
                candidates@lavelle.ng
              </a>
              <span className="text-neutral-600">+234 700 528 3553</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {FOOTER_COLS.map((c) => (
              <div key={c.heading}>
                <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-700">{c.heading}</div>
                <div className="flex flex-col gap-[9px] mt-4">
                  {c.links.map((l) => (
                    <Link key={l.label} href={l.href} className="text-[12.5px] text-neutral-700 no-underline hover:text-accent">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-6 mt-11 pt-[22px] border-t border-dashed border-neutral-300 flex-wrap text-[11.5px] text-neutral-700">
          <span>&copy; 2026 Lavelle Institute. All rights reserved.</span>
          <div className="flex gap-[22px]">
            <a href="#" className="text-neutral-700 no-underline hover:text-accent">
              Terms of Use
            </a>
            <a href="#" className="text-neutral-700 no-underline hover:text-accent">
              Privacy Policy
            </a>
            <Link href="/verify" className="text-neutral-700 no-underline hover:text-accent">
              Verify a credential
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
