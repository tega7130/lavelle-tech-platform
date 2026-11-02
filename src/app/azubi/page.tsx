import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiButton } from "@/components/azubi/azubi-button";
import { AzubiKicker, AzubiTag, AzubiDisc, AzubiFaqItem } from "@/components/azubi/azubi-ui";
import { AzubiEnquiryForm } from "@/components/azubi/azubi-enquiry-form";

export const metadata: Metadata = azubiMetadata(
  "/azubi",
  "Legal Fellowship Program",
  "Azubi Foundation places law students, law school graduates and newly called lawyers with law firms and legal organisations, where a lawyer supervises their work."
);

export default function AzubiHomePage() {
  return (
    <>
      <section className="bg-azubi-green-50">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pt-8 sm:pt-16 pb-10 sm:pb-[88px]">
          <div className="max-w-[880px] mx-auto flex flex-col gap-6 items-center text-center">
            <AzubiKicker>Legal Fellowship Program</AzubiKicker>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[46px]">
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-apricot),var(--color-azubi-apricot))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                Practical Experience.
              </span>{" "}
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-sage-light),var(--color-azubi-sage-light))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                Professional Growth.
              </span>{" "}
              <span className="relative inline bg-[linear-gradient(var(--color-azubi-apricot),var(--color-azubi-apricot))] bg-no-repeat [background-size:100%_34%] [background-position:0_90%]">
                Career Development.
              </span>
            </h1>
            <p className="text-[18px] sm:text-[22px] text-azubi-muted max-w-[580px]">
              We bridge the gap between legal education and practice, giving emerging lawyers the opportunity to gain
              hands-on experience, develop practical skills, and build the confidence to thrive in their legal
              careers.
            </p>
            <div className="flex flex-wrap gap-3 justify-center w-full sm:w-auto">
              <AzubiButton href="/azubi/apply" className="w-full sm:w-auto justify-between sm:justify-center">
                Apply as a fellow
              </AzubiButton>
              <AzubiButton href="/azubi/contact" variant="outline" className="w-full sm:w-auto justify-between sm:justify-center">
                Host a fellow
              </AzubiButton>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-10 sm:py-[88px]">
        <div className="flex flex-wrap gap-5">
          <div className="flex-1 min-w-[300px] bg-azubi-apricot-100 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11 flex flex-col gap-5 items-start">
            <AzubiTag bg="bg-azubi-apricot">For fellows</AzubiTag>
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] max-w-[14em]">Law students, graduates and newly called lawyers</h2>
            <p className="max-w-[44ch] text-azubi-muted">
              Do real, supervised legal work, learn how a firm or legal organisation runs, and build a record of
              practical experience.
            </p>
            <AzubiButton href="/azubi/apply">Apply as a fellow</AzubiButton>
          </div>
          <div className="flex-1 min-w-[300px] bg-azubi-green-100 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 lg:p-11 flex flex-col gap-5 items-start">
            <AzubiTag bg="bg-azubi-sage-light">For hosts</AzubiTag>
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] max-w-[14em]">Law firms and legal organisations</h2>
            <p className="max-w-[44ch] text-azubi-muted">
              Supervise a fellow, help shape the next generation of lawyers, and tell us how many fellows you could
              take and in which practice areas.
            </p>
            <AzubiButton href="/azubi/contact" variant="outline">
              Talk to us
            </AzubiButton>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-10 sm:py-[88px]">
        <div className="flex flex-col gap-9">
          <div className="flex flex-col gap-[14px] items-start">
            <AzubiKicker dot="bg-azubi-sage-light">How it works</AzubiKicker>
            <h2>From application to your first supervised task</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { n: 1, bg: "bg-azubi-apricot-100", disc: "bg-azubi-apricot", t: "Apply", d: "Tell us about your studies and interests in a short form. It takes about five minutes." },
              { n: 2, bg: "bg-azubi-green-100", disc: "bg-azubi-sage-light", t: "Get verified", d: "If you are shortlisted, you confirm your status with a student ID, law school ID or call certificate." },
              { n: 3, bg: "bg-azubi-apricot-100", disc: "bg-azubi-apricot", t: "Get matched", d: "We try to match you with a host law firm or legal organisation. Placement depends on host availability." },
              { n: 4, bg: "bg-azubi-green-100", disc: "bg-azubi-sage-light", t: "Learn under supervision", d: "A lawyer at the host supervises your work. Azubi stays in touch throughout." },
            ].map((s) => (
              <div key={s.n} className={`flex-1 min-w-[230px] ${s.bg} rounded-[24px] p-7 flex flex-col gap-[14px]`}>
                <AzubiDisc bg={s.disc}>{s.n}</AzubiDisc>
                <h3>{s.t}</h3>
                <p className="text-azubi-muted text-[17px]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pb-10 sm:pb-[88px]">
        <div className="bg-azubi-green-900 text-white rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-16 flex flex-wrap gap-9 sm:gap-14 items-center">
          <div className="flex-1 min-w-[300px] flex flex-col gap-5 items-start">
            <AzubiKicker dot="bg-azubi-apricot">
              <span className="text-white">Supervision first</span>
            </AzubiKicker>
            <h2 className="text-white">Every placement has a lawyer in charge</h2>
            <p className="text-azubi-mint text-[20px] max-w-[46ch]">
              Fellows learn by doing real work, and a qualified lawyer at the host organisation reviews it. Azubi
              handles recruitment, verification and matching so hosts can focus on teaching.
            </p>
          </div>
          <div className="flex-1 min-w-[280px] flex flex-col gap-[14px]">
            <div className="bg-azubi-apricot rounded-[20px] p-5">
              <b className="block text-[20px] text-azubi-green-900">Supervised day to day</b>
              <p className="text-[17px] text-azubi-green-900">Work is reviewed by a lawyer at the host.</p>
            </div>
            <div className="bg-azubi-sage-light rounded-[20px] p-5">
              <b className="block text-[20px] text-azubi-green-900">Status verified</b>
              <p className="text-[17px] text-azubi-green-900">Fellows confirm their student or Bar status after shortlisting.</p>
            </div>
            <div className="bg-azubi-apricot rounded-[20px] p-5">
              <b className="block text-[20px] text-azubi-ink">Clear scope of work</b>
              <p className="text-[17px] text-azubi-ink">Tasks match each fellow&rsquo;s level and stay within supervision.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pb-10 sm:pb-[88px]">
        <div className="bg-azubi-green-50 rounded-[24px] sm:rounded-[32px] p-7 sm:p-12 lg:p-16 flex flex-wrap gap-8 sm:gap-14 items-start">
          <div className="flex-1 min-w-[280px] flex flex-col gap-[14px] items-start">
            <AzubiKicker>Questions</AzubiKicker>
            <h2>What people ask us</h2>
          </div>
          <div className="flex-[2] min-w-[300px] flex flex-col gap-3">
            <AzubiFaqItem question="What is Azubi Foundation?">
              Azubi Foundation is a Nigerian nonprofit initiative that helps new lawyers gain practical experience
              while supporting access to legal services. Through our Legal Fellowship Program, we place fellows with
              law firms and legal organisations, where qualified lawyers supervise their work.
            </AzubiFaqItem>
            <AzubiFaqItem question="Who can apply for the fellowship?">
              The fellowship is for law graduates at the start of their careers. You can apply if you have been
              called to the Bar and are not yet employed, have written the Bar exams and are awaiting call, or are an
              LLB student or graduate.
            </AzubiFaqItem>
            <AzubiFaqItem question="Is the fellowship open to lawyers without work experience?">
              Yes. The fellowship is designed for people who have the training but have not yet had the chance to
              practise. You don&rsquo;t need prior work experience, only commitment and a willingness to learn. The
              work you are given will match your status and be reviewed by your supervisor.
            </AzubiFaqItem>
            <AzubiFaqItem question="Is the fellowship paid?">
              This depends on your host law firm or organisation. Azubi does not pay fellows. Any stipend or
              support, such as transport, is decided by the host and confirmed before you start.
            </AzubiFaqItem>
            <AzubiFaqItem question="Will fellows work on real cases?">
              Fellows do real legal work under a supervising lawyer, such as research, drafting, document review,
              filings, file preparation and court preparation. The exact work depends on the host firm and your
              status. Fellows who have not yet been called to the Bar do not appear in court or act for clients on
              their own.
            </AzubiFaqItem>
            <AzubiFaqItem question="Does the fellowship lead to a job?">
              The fellowship does not guarantee a job. What it gives you is supervised, hands-on experience, a
              record of the work you&rsquo;ve done, a supervisor&rsquo;s feedback and a professional reference at the
              end. Some hosts may offer opportunities to fellows who do well, but that is the host&rsquo;s decision.
            </AzubiFaqItem>
            <AzubiFaqItem question="How can a law firm or organisation partner with Azubi Foundation?">
              Law firms, legal departments, NGOs and legal aid organisations can partner with us to host fellows. You
              provide a qualified supervising lawyer and suitable work, and we handle matching, simple check-in
              cards to track each fellow&rsquo;s progress, and any issues that arise. To start,{" "}
              <Link href="/azubi/contact">contact us</Link> and we will share a short application and the placement
              agreement.
            </AzubiFaqItem>
            <AzubiFaqItem question="How can I support Azubi Foundation?">
              <>
                There are several ways to help right now:
                <ul className="mt-[10px] pl-[22px] flex flex-col gap-[6px] list-disc">
                  <li>Host a fellow at your firm or organisation</li>
                  <li>Mentor a fellow or run a training session</li>
                  <li>Refer fellows or partner organisations to us</li>
                  <li>Share our work with your network</li>
                </ul>
                <p className="mt-3">
                  To talk about other ways to support us, <Link href="/azubi/contact">contact us</Link>.
                </p>
              </>
            </AzubiFaqItem>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pb-10 sm:pb-[88px]">
        <div className="bg-azubi-apricot rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 lg:p-14 flex flex-wrap gap-6 sm:gap-10 items-center justify-between">
          <div className="flex-1 min-w-[280px] flex flex-col gap-[10px]">
            <h2 className="text-azubi-green-900">Ready to start?</h2>
            <p className="text-[20px] text-azubi-green-900">Apply in about five minutes. We contact shortlisted applicants by email.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AzubiButton href="/azubi/apply">Apply as a fellow</AzubiButton>
            <AzubiButton href="/azubi/contact" variant="white">
              Host a fellow
            </AzubiButton>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 pb-10 sm:pb-[96px]">
        <div className="bg-azubi-green-100 rounded-[24px] sm:rounded-[32px] p-6 sm:p-12 lg:p-16 flex flex-wrap gap-8 sm:gap-14 items-start">
          <div className="flex-1 min-w-[260px] flex flex-col gap-[18px] items-start">
            <AzubiKicker dot="bg-azubi-sage-light">Contact</AzubiKicker>
            <h2>Questions? Write to us</h2>
            <p className="text-azubi-muted text-[18px] max-w-[40ch]">
              Fellows with questions, firms that want to host, and anyone interested in partnering are all welcome.
            </p>
            <p className="text-azubi-muted text-[16px] max-w-[40ch]">
              Azubi Foundation does not provide legal advice through this website.
            </p>
          </div>
          <div className="flex-[2] min-w-[280px] bg-white rounded-[24px] p-5 sm:p-8 lg:p-10">
            <AzubiEnquiryForm idPrefix="home" source="home_form" />
          </div>
        </div>
      </section>
    </>
  );
}
