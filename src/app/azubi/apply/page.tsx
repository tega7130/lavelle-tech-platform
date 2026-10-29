import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiKicker, AzubiDisc } from "@/components/azubi/azubi-ui";
import { AzubiApplyForm } from "@/components/azubi/azubi-apply-form";

export const metadata: Metadata = azubiMetadata(
  "/azubi/apply",
  "Apply as a fellow",
  "Apply to the Azubi Foundation Legal Fellowship Program. It takes about five minutes — we review every application and contact shortlisted applicants by email."
);

export default function AzubiApplyPage() {
  return (
    <>
      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-2">
        <div className="bg-azubi-apricot-100 rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 lg:p-14 flex flex-wrap gap-7 sm:gap-10 items-end justify-between">
          <div className="flex-1 min-w-[300px] flex flex-col gap-4 items-start">
            <AzubiKicker>Legal Fellowship Program</AzubiKicker>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[46px]">Apply as a fellow</h1>
            <p className="text-[18px] sm:text-[22px] text-azubi-muted max-w-[580px]">
              It takes about five minutes. We review every application and contact shortlisted applicants by email.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-10 sm:py-[96px]">
        <div className="flex flex-wrap gap-6 sm:gap-7 items-start">
          <AzubiApplyForm />

          <aside className="flex-1 min-w-[280px] flex flex-col gap-4">
            <div className="bg-azubi-green-100 rounded-[24px] p-7 flex flex-col gap-[18px]">
              <h2 className="text-[24px]">What happens next</h2>
              <div className="flex gap-[14px] items-start">
                <AzubiDisc bg="bg-azubi-apricot">1</AzubiDisc>
                <span className="text-[17px] pt-[6px]">We review your application.</span>
              </div>
              <div className="flex gap-[14px] items-start">
                <AzubiDisc bg="bg-azubi-apricot">2</AzubiDisc>
                <span className="text-[17px] pt-[6px]">
                  If you are shortlisted, we ask you to confirm your status with a student ID, law school ID or call
                  certificate.
                </span>
              </div>
              <div className="flex gap-[14px] items-start">
                <AzubiDisc bg="bg-azubi-apricot">3</AzubiDisc>
                <span className="text-[17px] pt-[6px]">We try to match you with a host organisation.</span>
              </div>
            </div>
            <div className="bg-azubi-apricot-100 rounded-[24px] p-7 flex flex-col gap-3">
              <h2 className="text-[24px]">Please note</h2>
              <ul className="m-0 pl-[20px] flex flex-col gap-[10px] text-[17px] list-disc">
                <li>Do not upload documents or send ID numbers on this form.</li>
                <li>
                  Questions? <Link href="/azubi/contact">Write to us</Link>.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
