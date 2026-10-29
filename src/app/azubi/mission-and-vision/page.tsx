import type { Metadata } from "next";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiButton } from "@/components/azubi/azubi-button";
import { AzubiKicker, AzubiTag } from "@/components/azubi/azubi-ui";

export const metadata: Metadata = azubiMetadata(
  "/azubi/mission-and-vision",
  "Mission and vision",
  "Azubi Foundation's mission is to expand access to justice by empowering a new generation of socially conscious lawyers through supervised, real-world legal experience."
);

export default function AzubiMissionPage() {
  return (
    <>
      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-2">
        <div className="bg-azubi-green-50 rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 lg:p-14">
          <div className="flex flex-col gap-4 items-start max-w-[780px]">
            <AzubiKicker>Azubi Foundation</AzubiKicker>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[46px]">
              Our{" "}
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-apricot),var(--color-azubi-apricot))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                mission
              </span>{" "}
              and{" "}
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-sage-light),var(--color-azubi-sage-light))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                vision
              </span>
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-5 sm:pt-8 pb-10 sm:pb-[88px]">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="bg-azubi-green-700 text-white rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-16 flex flex-col gap-5 items-start">
            <AzubiTag bg="bg-azubi-apricot">Our mission</AzubiTag>
            <p className="font-azubi font-semibold text-[20px] sm:text-[24px] lg:text-[28px] leading-[1.5] max-w-[900px] tracking-[-0.01em]">
              To expand access to justice by empowering a new generation of socially conscious lawyers through
              supervised, real-world legal experience in underserved communities, bridging the gap between legal
              education and practice.
            </p>
          </div>

          <div className="bg-azubi-apricot-100 rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-16 flex flex-col gap-5 items-start">
            <AzubiTag bg="bg-azubi-apricot">Our vision</AzubiTag>
            <p className="font-azubi font-semibold text-[20px] sm:text-[24px] lg:text-[28px] leading-[1.5] max-w-[900px] tracking-[-0.01em] text-azubi-green-900">
              A just society where every individual, regardless of their means, can access quality legal support,
              and every emerging lawyer is equipped with the skills, exposure, and values needed to lead
              transformative change in the legal profession.
            </p>
          </div>

          <div className="bg-azubi-green-900 text-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-9 lg:p-14 flex flex-wrap gap-5 sm:gap-8 items-center justify-between">
            <p className="text-[18px] sm:text-[20px] lg:text-[22px] font-bold leading-[1.4] max-w-[560px] text-white">
              Practical Experience. Professional Growth. Career Development.
            </p>
            <AzubiButton href="/azubi/apply" variant="white">
              Apply as a fellow
            </AzubiButton>
          </div>
        </div>
      </section>
    </>
  );
}
