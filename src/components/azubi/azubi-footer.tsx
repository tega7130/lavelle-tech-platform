import Link from "next/link";
import { AZUBI_FOOTER_LINKS } from "./azubi-nav";
import { AzubiCookieSettingsLink } from "./azubi-cookie-banner";

export function AzubiFooter() {
  return (
    <footer className="bg-azubi-green-900 text-[#E4EFEC]">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-12 sm:pt-14 pb-8 sm:pb-10">
        <div className="flex flex-wrap gap-8 sm:gap-16 justify-between">
          <div className="flex-1 min-w-[260px]">
            <div className="flex flex-col leading-none">
              <span className="font-azubi text-[26px] font-extrabold tracking-[-0.03em] text-white">Azubi</span>
              <span className="text-[11px] tracking-[0.34em] uppercase font-bold mt-[5px] text-azubi-sage">Foundation</span>
            </div>
            <p className="text-[17px] mt-[18px] max-w-[340px]">
              A nonprofit initiative founded by the team behind Lavelle Development Technologies Limited.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-[6px] text-[17px] content-start">
            {AZUBI_FOOTER_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="text-white no-underline hover:underline py-[6px]">
                {l.label}
              </Link>
            ))}
            <AzubiCookieSettingsLink />
          </nav>
        </div>

        <div className="border-t border-azubi-green-700 mt-9 pt-[22px] flex flex-wrap gap-x-8 gap-y-[10px] justify-between text-[15px] text-azubi-mint">
          <span>Azubi Foundation does not provide legal advice through this website.</span>
          <span>
            Hosted on{" "}
            <Link href="/" className="text-white no-underline hover:underline">
              Lavelle
            </Link>{" "}
            · learnlavelle.com/azubi
          </span>
        </div>
      </div>
    </footer>
  );
}
