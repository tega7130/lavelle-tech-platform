import Link from "next/link";
import { AZUBI_FOOTER_COLS, AZUBI_FOOTER_LEGAL_LINKS } from "./azubi-nav";
import { AzubiCookieSettingsLink } from "./azubi-cookie-banner";

function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="inline-block align-[-2px] text-azubi-apricot">
      <path d="M12 21s-7.5-4.6-10.2-9.3C.3 8.9 1.4 5.4 4.6 4.2c2.1-.8 4.3.1 5.5 1.9l1.9 2.8 1.9-2.8c1.2-1.8 3.4-2.7 5.5-1.9 3.2 1.2 4.3 4.7 2.8 7.5C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function AzubiFooter() {
  return (
    <footer className="bg-azubi-green-900 text-[#E4EFEC]">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-12 sm:pt-14 pb-8 sm:pb-10">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] gap-10 md:gap-14">
          <div>
            <div className="flex flex-col leading-none">
              <span className="font-azubi text-[26px] font-extrabold tracking-[-0.03em] text-white">Azubi</span>
              <span className="text-[11px] tracking-[0.34em] uppercase font-bold mt-[5px] text-azubi-sage">Foundation</span>
            </div>
            <p className="text-[17px] mt-[18px] max-w-[340px]">
              A nonprofit initiative founded by the team behind Lavelle Development Technologies Limited.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {AZUBI_FOOTER_COLS.map((col) => (
              <div key={col.heading}>
                <div className="text-[12px] tracking-[0.18em] uppercase font-bold text-azubi-sage">{col.heading}</div>
                <div className="flex flex-col gap-[9px] mt-4">
                  {col.links.map((l) => (
                    <Link key={l.label} href={l.href} className="text-[17px] text-white no-underline hover:underline">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-[12px] tracking-[0.18em] uppercase font-bold text-azubi-sage">More</div>
              <div className="flex flex-col gap-[9px] mt-4 text-[17px]">
                {AZUBI_FOOTER_LEGAL_LINKS.map((l) => (
                  <Link key={l.label} href={l.href} className="text-white no-underline hover:underline">
                    {l.label}
                  </Link>
                ))}
                <AzubiCookieSettingsLink />
              </div>
            </div>
          </nav>
        </div>

        <div className="border-t border-azubi-green-700 mt-9 pt-[22px] flex flex-wrap gap-x-8 gap-y-[10px] justify-between text-[15px] text-azubi-mint">
          <span>Azubi Foundation does not provide legal advice through this website.</span>
          <span>
            Made with <HeartIcon /> by{" "}
            <Link href="/" className="text-white no-underline hover:underline">
              Lavelle Development Technologies Limited
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
