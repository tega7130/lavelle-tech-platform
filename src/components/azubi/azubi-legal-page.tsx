import { AzubiKicker } from "./azubi-ui";

export function AzubiLegalPage({
  kicker,
  title,
  lead,
  lastUpdated,
  toc,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  lastUpdated: React.ReactNode;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-2">
        <div className="bg-azubi-green-50 rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 lg:p-14">
          <div className="flex flex-col gap-4 items-start max-w-[780px]">
            <AzubiKicker>{kicker}</AzubiKicker>
            <h1 className="text-[30px] sm:text-[40px] lg:text-[46px]">{title}</h1>
            <p className="text-[18px] sm:text-[20px] text-azubi-muted max-w-[580px]">{lead}</p>
            <p className="text-[16px] text-azubi-muted">Last updated: {lastUpdated}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-10">
        <div className="flex flex-wrap gap-6 sm:gap-7 items-start">
          <aside className="flex-1 min-w-[260px] bg-azubi-green-100 rounded-[24px] p-5 flex flex-col gap-[6px]">
            <AzubiKicker>On this page</AzubiKicker>
            <nav aria-label="Table of contents" className="flex flex-col mt-2">
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block px-3 py-[9px] rounded-[10px] text-azubi-green-900 no-underline font-semibold text-[16px] leading-[1.4] hover:bg-azubi-mint"
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex-[3] min-w-[280px] bg-white border-2 border-azubi-mint rounded-[28px] p-6 sm:p-9 lg:p-12 [&_h2]:text-[24px] [&_h2]:leading-[1.25] [&_h2]:mt-10 [&_h2:first-child]:mt-0 [&_h2]:mb-3 [&_p]:text-[17px] [&_p]:leading-[1.75] [&_p]:text-azubi-ink [&_li]:text-[17px] [&_li]:leading-[1.75] [&_p+p]:mt-[14px] [&_ul]:mt-3 [&_ul]:pl-[22px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_a]:underline">
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
