import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiKicker, AzubiTag } from "@/components/azubi/azubi-ui";
import { AzubiEnquiryForm } from "@/components/azubi/azubi-enquiry-form";

export const metadata: Metadata = azubiMetadata(
  "/azubi/contact",
  "Contact",
  "Prospective fellows, law firms and legal organisations are all welcome to write to the Azubi Foundation team."
);

export default async function AzubiContactPage({ searchParams }: PageProps<"/azubi/contact">) {
  const params = await searchParams;
  const asHost = params?.as === "host";

  return (
    <>
      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-2">
        <div className="bg-azubi-apricot-100 rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 lg:p-14 flex flex-wrap gap-7 sm:gap-10 items-end justify-between">
          <div className="flex-1 min-w-[300px] flex flex-col gap-4 items-start">
            <AzubiKicker dot="bg-azubi-sage-light">Contact</AzubiKicker>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[46px]">Talk to the Azubi team</h1>
            <p className="text-[18px] sm:text-[22px] text-azubi-muted max-w-[580px]">
              Prospective fellows, law firms and legal organisations are all welcome to write to us.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-10 sm:py-[88px]">
        <div className="flex flex-wrap gap-6 sm:gap-7 items-start">
          <div className="flex-[2] min-w-[300px] bg-white border-2 border-azubi-mint rounded-[28px] p-6 sm:p-9 lg:p-11">
            <AzubiEnquiryForm idPrefix="contact" source="contact_page" defaultWritingAs={asHost ? "A law firm or legal organisation" : undefined} />
          </div>
          <aside className="flex-1 min-w-[280px] flex flex-col gap-[14px]">
            <h2 className="text-[26px] mb-1">Which message is yours?</h2>
            <div className="bg-azubi-green-100 rounded-[24px] p-6">
              <AzubiTag bg="bg-azubi-sage-light">Prospective fellows</AzubiTag>
              <p className="mt-3 text-[17px]">
                Questions about eligibility or the application. To apply, use the{" "}
                <Link href="/azubi/apply">application form</Link>.
              </p>
            </div>
            <div className="bg-azubi-apricot-100 rounded-[24px] p-6">
              <AzubiTag bg="bg-azubi-apricot">Law firms and organisations</AzubiTag>
              <p className="mt-3 text-[17px]">Tell us your practice areas and how many fellows you could supervise.</p>
            </div>
            <div className="bg-azubi-green-50 rounded-[24px] p-6">
              <AzubiTag bg="bg-azubi-mint">Everyone else</AzubiTag>
              <p className="mt-3 text-[17px]">Partnerships, media and general enquiries.</p>
            </div>
            <p className="text-[16px] text-azubi-muted px-[6px]">
              Azubi Foundation does not provide legal advice through this website. Please do not send details of a
              legal matter.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
