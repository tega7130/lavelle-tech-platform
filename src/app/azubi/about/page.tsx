import type { Metadata } from "next";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiButton } from "@/components/azubi/azubi-button";
import { AzubiKicker } from "@/components/azubi/azubi-ui";

export const metadata: Metadata = azubiMetadata(
  "/azubi/about",
  "About",
  "Azubi Foundation connects law students, law school graduates and newly called lawyers with law firms and legal organisations for supervised, hands-on experience."
);

export default function AzubiAboutPage() {
  return (
    <>
      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-2">
        <div className="bg-azubi-green-50 rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-[72px]">
          <div className="flex flex-col gap-[18px] items-start max-w-[780px]">
            <AzubiKicker>About Azubi Foundation</AzubiKicker>
            <h1 className="text-[28px] sm:text-[40px] lg:text-[56px]">
              Every Legal Career{" "}
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-apricot),var(--color-azubi-apricot))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                Starts Somewhere.
              </span>
            </h1>
            <p className="text-[18px] sm:text-[22px] text-azubi-muted">We remember what it felt like to be at the beginning.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-5 sm:pt-8 pb-10 sm:pb-[88px]">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="bg-azubi-green-100 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
            <div className="max-w-[760px] flex flex-col gap-[18px] text-[18px] sm:text-[21px] leading-[1.7]">
              <p>
                Imagine sitting with your friends after writing your Bar exams. You have spent years studying the law,
                survived the demands of law school, and worked towards the moment you can finally call yourself a
                lawyer.
              </p>
              <p>You are excited. You have plans. You are ready to make something of your career.</p>
            </div>
          </div>

          <div className="bg-azubi-apricot rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
            <h2 className="text-[28px] sm:text-[36px] lg:text-[48px] leading-[1.15] max-w-[760px]">
              Then comes the question: What next?
            </h2>
          </div>

          <div className="bg-azubi-green-50 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
            <div className="max-w-[760px] flex flex-col gap-[18px] text-[17px] sm:text-[18px] leading-[1.7]">
              <p>
                You open your CV, ready to apply for opportunities, only to realise that while you have the
                qualifications, you have little or no practical work experience to show for it. You know the law in
                theory, but you are still waiting for the opportunity to see how it works in practice.
              </p>
              <p>
                You start looking for that first job, internship, or chance to learn from someone who has been where
                you hope to go. And sometimes, the hardest part is getting someone to give you that first
                opportunity.
              </p>
            </div>
          </div>

          <div className="bg-azubi-apricot rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
            <h2 className="text-[26px] sm:text-[34px] lg:text-[42px] leading-[1.2] max-w-[760px]">
              That is the gap Azubi Foundation hopes to help bridge.
            </h2>
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6">
            <div className="flex-1 min-w-[280px] bg-azubi-green-50 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
              <p className="text-[17px] sm:text-[18px] leading-[1.7]">
                We believe that emerging lawyers deserve opportunities to move beyond the classroom, apply their
                knowledge, develop practical skills, and discover where they can make their mark in the legal
                profession.
              </p>
            </div>
            <div className="flex-1 min-w-[280px] bg-azubi-apricot-100 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11">
              <p className="text-[17px] sm:text-[18px] leading-[1.7]">
                Azubi Foundation is an initiative focused on connecting emerging legal professionals with
                opportunities for supervised, hands-on experience in law firms and other organisations. Through our
                developing fellowship model, we aim to help young lawyers learn from practical work, gain
                professional exposure, and build a stronger foundation for their careers.
              </p>
            </div>
          </div>

          <div className="bg-azubi-green-900 rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-16 text-[#E4EFEC]">
            <div className="max-w-[800px] flex flex-col gap-7">
              <h2 className="text-[26px] sm:text-[34px] lg:text-[42px] leading-[1.25]">
                <span className="block text-azubi-sage-light">Potential needs an opportunity.</span>
                <span className="block text-azubi-apricot">Knowledge needs practice.</span>
                <span className="block text-white">And every promising legal career deserves a place to begin.</span>
              </h2>
              <p className="text-[18px] sm:text-[21px] leading-[1.7] text-[#E4EFEC]">
                We are building towards a future where the journey from studying law to practising it feels less
                like a leap into the unknown and more like a path with opportunities to learn, contribute, and grow.
              </p>
              <div className="border-t border-azubi-green-700 pt-6 flex flex-wrap gap-5 sm:gap-8 items-center justify-between">
                <div>
                  <p className="text-[20px] font-extrabold text-white leading-[1.3]">Azubi Foundation</p>
                  <p className="text-[17px] text-azubi-mint mt-1">Practical Experience. Professional Growth. Career Development.</p>
                </div>
                <AzubiButton href="/azubi/apply" variant="white">
                  Apply as a fellow
                </AzubiButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
