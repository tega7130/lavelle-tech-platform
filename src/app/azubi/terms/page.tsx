import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiLegalPage } from "@/components/azubi/azubi-legal-page";

export const metadata: Metadata = azubiMetadata(
  "/azubi/terms",
  "Terms of use",
  "The rules for using the Azubi Foundation website and applying to the fellowship."
);

const TOC = [
  { id: "who-we-are", label: "1. Who we are" },
  { id: "definitions", label: "2. Definitions" },
  { id: "acceptance", label: "3. Acceptance and eligibility" },
  { id: "using-the-website", label: "4. Using the Website" },
  { id: "applications", label: "5. Applications for the Fellowship" },
  { id: "legal-information", label: "6. Legal information and services" },
  { id: "fellows-and-hosts", label: "7. Fellows and Host Organisations" },
  { id: "intellectual-property", label: "8. Intellectual property" },
  { id: "third-party-links", label: "9. Third-party links and services" },
  { id: "privacy-and-cookies", label: "10. Privacy and cookies" },
  { id: "disclaimers", label: "11. Disclaimers" },
  { id: "liability", label: "12. Limitation of liability" },
  { id: "indemnity", label: "13. Indemnity" },
  { id: "termination", label: "14. Suspension and termination" },
  { id: "changes", label: "15. Changes to these Terms" },
  { id: "governing-law", label: "16. Governing law and disputes" },
  { id: "general", label: "17. General" },
  { id: "contact", label: "18. Contact" },
  { id: "schedule-1", label: "Schedule 1: Fellow Standards" },
  { id: "schedule-safeguarding", label: "Schedule 1 — Safeguarding" },
  { id: "schedule-complaints", label: "Schedule 1 — Complaints" },
  { id: "schedule-conflicts", label: "Schedule 1 — Conflicts of interest" },
  { id: "schedule-harassment", label: "Schedule 1 — Anti-harassment and discrimination" },
  { id: "schedule-review", label: "Schedule 1 — Review" },
];

export default function AzubiTermsPage() {
  return (
    <AzubiLegalPage
      kicker="Azubi Foundation"
      title="Terms of use"
      lead="Please read these Terms before using the Azubi website or applying to the Azubi fellowship. Our Privacy Notice forms part of these Terms, as do the Fellow Standards in Schedule 1."
      lastUpdated="30 October 2026"
      toc={TOC}
    >
      <p>
        Please read these Terms of Use (&ldquo;Terms&rdquo;) before using the Azubi website at <Link href="/azubi">learnlavelle.com/azubi</Link>{" "}
        (the &ldquo;Website&rdquo;) or applying to the Azubi fellowship (the &ldquo;Fellowship&rdquo;). Our{" "}
        <Link href="/azubi/privacy">Privacy Notice</Link> forms part of these Terms, as do the Fellow Standards in{" "}
        <a href="#schedule-1">Schedule 1</a>.
      </p>

      <h2 id="who-we-are">1. Who we are</h2>
      <p>
        1.1 The Website and the Fellowship are run by <strong>Azubi Foundation</strong> (&ldquo;Azubi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or
        &ldquo;our&rdquo;). Azubi Foundation is a non-profit organisation established by Lavelle Development Technologies Limited.
      </p>
      <p>
        1.2 Azubi Foundation is a separate organisation from Lavelle Development Technologies Limited and is not a trading name of it.
        Nothing in these Terms creates a partnership, agency, joint venture or employment relationship between you and us, or between
        you and any Host Organisation.
      </p>

      <h2 id="definitions">2. Definitions</h2>
      <p>
        2.1 <strong>&ldquo;Applicant&rdquo;</strong> means a person who submits an application through the Website.
      </p>
      <p>
        2.2 <strong>&ldquo;Fellow&rdquo;</strong> means an Applicant who has been accepted onto the Fellowship in writing.
      </p>
      <p>
        2.3 <strong>&ldquo;Host Organisation&rdquo;</strong> means a law firm, legal department, court, non-governmental organisation,
        public body or other organisation that has agreed in writing with us to host Fellows.
      </p>
      <p>
        2.4 <strong>&ldquo;Content&rdquo;</strong> means text, images, logos, designs, software, data and other material on the Website.
      </p>
      <p>
        2.5 <strong>&ldquo;Materials&rdquo;</strong> means anything you submit to us, including forms, statements, messages and
        attachments.
      </p>
      <p>
        2.6 <strong>&ldquo;Supervisor&rdquo;</strong> means a qualified legal practitioner designated by a Host Organisation or by us to
        oversee a Fellow&rsquo;s work.
      </p>
      <p>
        2.7 <strong>&ldquo;You&rdquo;</strong> means any person who accesses or uses the Website, whether as a visitor, Applicant,
        Fellow, Host Organisation representative or other user.
      </p>

      <h2 id="acceptance">3. Acceptance and eligibility</h2>
      <p>3.1 By accessing or using the Website, you agree to these Terms. If you do not agree, do not use the Website.</p>
      <p>
        3.2 The Fellowship is open to law students and law graduates who meet the eligibility criteria published on the Website at the
        time of application. The criteria in force when you apply will govern your application.
      </p>
      <p>
        3.3 <strong>Age.</strong> The Website and the Fellowship are for people aged 18 years and above only. Only people aged 18 and
        above may use the Website or apply. By applying, you confirm that you are at least 18. We may ask for proof of age or enrolment
        at any stage. If we find that the confirmation was untrue, we will withdraw the application or end the Fellowship.
      </p>
      <p>
        3.4 If you use the Website on behalf of an organisation, you confirm that you have authority to bind that organisation to these
        Terms.
      </p>

      <h2 id="using-the-website">4. Using the Website</h2>
      <p>
        4.1 We grant you a limited, personal, non-exclusive, non-transferable, revocable licence to access and view the Website for
        lawful purposes, including reading about the Fellowship and submitting an application or enquiry.
      </p>
      <p>4.2 You may not:</p>
      <p className="pl-[20px]">
        (a) copy, reproduce, distribute, modify or create derivative works from the Content, except for personal, non-commercial use or
        as permitted by the Copyright Act 2022 or other applicable law;
      </p>
      <p className="pl-[20px]">(b) use the Website to support, promote or conceal unlawful activity;</p>
      <p className="pl-[20px]">
        (c) attempt to gain unauthorised access to the Website, its servers, or any account, form or data held by us;
      </p>
      <p className="pl-[20px]">
        (d) interfere with the operation of the Website, including by introducing malware, overloading systems or bypassing security
        features;
      </p>
      <p className="pl-[20px]">
        (e) use automated means (including bots, scrapers or spiders) to access or collect data from the Website, other than public
        search engines operating under standard rules;
      </p>
      <p className="pl-[20px]">(f) submit false, misleading or impersonating information;</p>
      <p className="pl-[20px]">(g) use the Website to harass, threaten, defame or intimidate any person; or</p>
      <p className="pl-[20px]">
        (h) use the Website, or any name, logo or material associated with it, in a way that suggests endorsement by a Host
        Organisation or any other person without written permission.
      </p>

      <h2 id="applications">5. Applications for the Fellowship</h2>
      <p>
        5.1 <strong>No fee and no payments.</strong> There is no fee to apply. Azubi does not collect money of any kind. You will not be
        asked to pay anything through the Website or the Azubi platform.
      </p>
      <p>
        5.2 <strong>Accuracy.</strong> You must provide accurate, complete and current information. We may verify the information you
        provide, including your university or law school, your status and your identity. False or misleading information may result in
        rejection of your application or termination of your Fellowship.
      </p>
      <p>
        5.3 <strong>Information you should not submit.</strong> Do not upload documents, send identification numbers, or describe the
        details of any legal matter, dispute or case through our forms. Our forms are not suitable for confidential or privileged
        material. If we later need documents, we will tell you how to provide them securely.
      </p>
      <p>
        5.4 <strong>No guarantee of selection.</strong> Submitting an application does not guarantee that you will be shortlisted,
        interviewed or accepted. Selection is at our discretion, applying the criteria we publish. We are not required to give reasons,
        although we may do so.
      </p>
      <p>
        5.5 <strong>Shortlisting and confirmation.</strong> If you are shortlisted, we will tell you how to confirm your status. If you
        do not respond within the time we specify, we may treat your application as withdrawn.
      </p>
      <p>
        5.6 <strong>Status of Fellows.</strong> Fellows are not employees of Azubi. A Fellow is an intern within the Azubi network. Azubi
        does not pay Fellows any salary, wage, stipend or fee.
      </p>
      <p>
        5.7 <strong>Placement.</strong> Acceptance does not guarantee a placement with a particular Host Organisation. Where a placement
        is arranged, the Host Organisation&rsquo;s own terms will govern duties, supervision, workplace conditions and any payment, in
        addition to these Terms and the Fellow Standards.
      </p>
      <p>
        5.8 <strong>Insurance.</strong> Azubi does not provide insurance for Fellows, the Fellowship or any activity connected with it.
        Host Organisations may provide their own insurance. You are responsible for arranging any personal insurance you consider
        necessary.
      </p>
      <p>
        5.9 <strong>Withdrawal.</strong> You may withdraw your application or Fellowship at any time by{" "}
        <Link href="/azubi/contact">contacting us</Link> through the Website.
      </p>
      <p>5.10 Acceptance takes effect only when confirmed to you in writing by us.</p>

      <h2 id="legal-information">6. Legal information and services</h2>
      <p>
        6.1 <strong>Azubi does not provide legal advice.</strong> Information on the Website, and any response we send, is general
        information about the Fellowship and our activities. It is not legal advice and does not create a solicitor-client
        relationship. You should obtain independent legal advice before acting on any legal matter.
      </p>
      <p>6.2 Fellows must not give legal advice to members of the public, or hold themselves out as legal practitioners, unless:</p>
      <p className="pl-[20px]">(a) they are working under the direct, documented supervision of a qualified legal practitioner; and</p>
      <p className="pl-[20px]">(b) the work is within the scope authorised by that Supervisor and by us in writing.</p>
      <p>
        6.3 <strong>Legal Practitioners Act.</strong> Nothing in these Terms permits any person to practise law in breach of the Legal
        Practitioners Act or the Rules of Professional Conduct for Legal Practitioners.
      </p>
      <p>
        6.4 <strong>Enquiries.</strong> If you contact us through the Website, we will use your message to respond and to manage the
        Fellowship, in line with the Privacy Notice. We do not guarantee any response time unless we say so in writing.
      </p>

      <h2 id="fellows-and-hosts">7. Fellows and Host Organisations</h2>
      <p>
        7.1 <strong>Conduct.</strong> Fellows must comply with these Terms, the Fellow Standards, any written Fellowship terms and the
        rules of any Host Organisation.
      </p>
      <p>
        7.2 <strong>Confidentiality.</strong> Fellows must not disclose confidential information obtained through the Fellowship or a
        placement, including client information and information subject to legal privilege, except as permitted by the relevant Host
        Organisation, by law or by written agreement.
      </p>
      <p>
        7.3 <strong>Host Organisations.</strong> Host Organisations are responsible for their own placement terms, workplace conditions,
        supervision, health and safety, and compliance with employment and labour laws. We do not control the day-to-day work of
        Fellows at Host Organisations.
      </p>
      <p>
        7.4 <strong>Third parties.</strong> We are not responsible for the acts or omissions of Host Organisations, other Fellows or any
        third party, except where liability cannot be excluded under applicable law.
      </p>
      <p>
        7.5 <strong>No endorsement.</strong> A reference to a Host Organisation on the Website does not mean that we or any other Host
        Organisation endorse it or any other organisation.
      </p>

      <h2 id="intellectual-property">8. Intellectual property</h2>
      <p>
        8.1 The Content, including the Azubi name and logo, is owned by Azubi or its licensors and is protected by intellectual property
        laws. All rights not expressly granted are reserved.
      </p>
      <p>
        8.2 <strong>Your Materials.</strong> You keep ownership of the Materials you submit. By submitting them, you grant us a
        non-exclusive, royalty-free licence, for the period described in the Privacy Notice, to store, copy, use and process the
        Materials for the purposes in the Privacy Notice and these Terms, including to review applications, administer the Fellowship
        and communicate with you.
      </p>
      <p>
        8.3 You confirm that you own, or have permission to submit, the Materials, and that they do not infringe the rights of any third
        party or breach any law or duty of confidentiality.
      </p>
      <p>
        8.4 <strong>Feedback.</strong> If you give us suggestions or feedback, we may use them without restriction or compensation to
        you.
      </p>

      <h2 id="third-party-links">9. Third-party links and services</h2>
      <p>
        9.1 The Website may link to third-party websites or services. We do not control and are not responsible for them. Your use of
        them is at your own risk and subject to their own terms and privacy notices.
      </p>
      <p>9.2 Our hosting and form-processing providers process information on our behalf, as described in the Privacy Notice.</p>

      <h2 id="privacy-and-cookies">10. Privacy and cookies</h2>
      <p>
        10.1 Our collection and use of personal information is governed by the <Link href="/azubi/privacy">Privacy Notice</Link>, the
        Nigeria Data Protection Act 2023 (&ldquo;NDPA&rdquo;) and regulations made under it.
      </p>
      <p>
        10.2 Our use of cookies is described in the Privacy Notice. Choosing &ldquo;Essential only&rdquo; on our cookie banner means that
        no optional cookies are set. You may change your choice at any time through the cookie settings or by clearing cookies in your
        browser.
      </p>
      <p>10.3 If there is a conflict between these Terms and the Privacy Notice on personal information, the Privacy Notice prevails.</p>

      <h2 id="disclaimers">11. Disclaimers</h2>
      <p>
        11.1 <strong>As is.</strong> The Website and its Content are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        warranties of any kind, express or implied, including accuracy, completeness, fitness for a particular purpose,
        non-infringement and uninterrupted or error-free operation.
      </p>
      <p>
        11.2 <strong>Changes.</strong> We take reasonable care to keep information accurate and up to date, but eligibility criteria,
        programme details and dates may change. Where a change affects an existing Fellow, we will tell them in writing.
      </p>
      <p>
        11.3 <strong>No professional advice.</strong> The Website and the Fellowship do not provide legal, financial, immigration, tax
        or other professional advice.
      </p>
      <p>
        11.4 <strong>Availability.</strong> We do not guarantee that the Website will always be available or free from viruses or other
        harmful components. We may suspend access for maintenance or security.
      </p>

      <h2 id="liability">12. Limitation of liability</h2>
      <p>
        12.1 To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential or punitive
        loss, or for loss of profit, revenue, data, goodwill or opportunity, arising from your use of, or inability to use, the Website
        or the Fellowship.
      </p>
      <p>
        12.2 Subject to clause 12.3, our total liability to you for all claims arising under these Terms or your use of the Website is
        limited to <strong>NGN 50,000 in aggregate</strong>.
      </p>
      <p>12.3 Nothing in these Terms limits or excludes liability for:</p>
      <p className="pl-[20px]">(a) death or personal injury caused by our negligence;</p>
      <p className="pl-[20px]">(b) fraud or fraudulent misrepresentation;</p>
      <p className="pl-[20px]">
        (c) any liability that cannot be limited or excluded under Nigerian law, including the Federal Competition and Consumer
        Protection Act 2018 and regulations made under it; or
      </p>
      <p className="pl-[20px]">(d) a breach of the NDPA that cannot lawfully be excluded.</p>

      <h2 id="indemnity">13. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless Azubi and its directors, trustees, staff, volunteers and agents from any claim, loss,
        liability or expense (including reasonable legal fees) arising from:
      </p>
      <p className="pl-[20px]">(a) your breach of these Terms;</p>
      <p className="pl-[20px]">(b) your Materials, including any claim that they infringe the rights of a third party;</p>
      <p className="pl-[20px]">(c) your misuse of the Website or the Fellowship; or</p>
      <p className="pl-[20px]">
        (d) your conduct as a Fellow, to the extent that conduct breaches the Fellow Standards, a written Fellowship agreement or
        applicable law.
      </p>

      <h2 id="termination">14. Suspension and termination</h2>
      <p>
        14.1 We may suspend or restrict your access to the Website, or withdraw or end your application or Fellowship, if we reasonably
        believe you have:
      </p>
      <p className="pl-[20px]">(a) breached these Terms or the Fellow Standards;</p>
      <p className="pl-[20px]">(b) provided false or misleading information;</p>
      <p className="pl-[20px]">(c) put others at risk, or damaged our reputation or that of a Host Organisation;</p>
      <p className="pl-[20px]">(d) engaged in unlawful conduct; or</p>
      <p className="pl-[20px]">(e) been under 18 at the time of applying.</p>
      <p>
        14.2 Where practicable, we will tell you the reason and give you an opportunity to respond. We may act without notice where
        necessary to protect people, the Website or a Host Organisation.
      </p>
      <p>14.3 On termination, your right to use the Website ends. Clauses 8, 11, 12, 13, 14, 15 and 16 survive.</p>
      <p>
        14.4 <strong>Retention.</strong> We keep your personal information for <strong>six years</strong> from the date of your last
        interaction with us, unless the Privacy Notice or the law requires a different period. After that period, we delete or
        anonymise it.
      </p>

      <h2 id="changes">15. Changes to these Terms</h2>
      <p>15.1 We may update these Terms. The date at the top of this page shows when they were last changed.</p>
      <p>
        15.2 <strong>Notice.</strong> We will give at least 14 days&rsquo; notice on the Website of any material change. Minor changes
        take effect on publication.
      </p>
      <p>15.3 Continued use of the Website after a change takes effect means you accept the updated Terms.</p>
      <p>
        15.4 A change to a signed Fellowship agreement takes effect only with your written agreement, unless the agreement provides
        otherwise.
      </p>

      <h2 id="governing-law">16. Governing law and disputes</h2>
      <p>16.1 These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
      <p>
        16.2 <strong>Informal resolution.</strong> If a dispute arises, contact us through the Website&rsquo;s contact page and try to
        resolve it in good faith within <strong>30 days</strong>.
      </p>
      <p>
        16.3 <strong>Mediation.</strong> If the dispute is not resolved within that period, either party may refer it to mediation under
        the Arbitration and Mediation Act 2023 or another agreed process.
      </p>
      <p>
        16.4 <strong>Courts.</strong> If mediation does not resolve the dispute, the courts of Lagos State, Nigeria, have jurisdiction.
      </p>
      <p>16.5 You may also complain to the Nigeria Data Protection Commission, as described in the Privacy Notice.</p>

      <h2 id="general">17. General</h2>
      <p>
        17.1 <strong>Entire agreement.</strong> These Terms, the Privacy Notice, the Fellow Standards and any written Fellowship
        agreement form the entire agreement between you and us about the Website. They replace earlier understandings on the same
        subject.
      </p>
      <p>
        17.2 <strong>Severability.</strong> If any provision is invalid or unenforceable, the rest of these Terms remain in effect.
      </p>
      <p>
        17.3 <strong>No waiver.</strong> Failure to enforce a right does not waive it.
      </p>
      <p>
        17.4 <strong>Assignment.</strong> We may transfer our rights and obligations to a successor organisation that continues the
        Fellowship. You may not transfer your rights without our written consent.
      </p>
      <p>
        17.5 <strong>Force majeure.</strong> We are not liable for delay or failure caused by events beyond our reasonable control,
        including power failure, internet disruption, natural disaster, epidemic, war or government action.
      </p>
      <p>
        17.6 <strong>Language.</strong> These Terms are in English. If translated, the English version prevails.
      </p>

      <h2 id="contact">18. Contact</h2>
      <p>
        For questions about these Terms, use the <Link href="/azubi/contact">contact form</Link>, or write to{" "}
        <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>.
      </p>

      <h2 id="schedule-1">Schedule 1: Fellow Standards</h2>
      <p>
        <em>These standards apply to all Applicants during the application process and to all Fellows during the Fellowship. They form
        part of the Terms of Use.</em>
      </p>

      <h2 id="schedule-safeguarding">1. Safeguarding</h2>
      <p>
        1.1 <strong>Commitment.</strong> Azubi is committed to the safety and welfare of everyone who engages with the Fellowship,
        including Fellows, Applicants, staff, Host Organisation staff and clients of Host Organisations. In particular, we are
        committed to protecting children and adults at risk.
      </p>
      <p>
        1.2 <strong>Scope.</strong> Our safeguarding duties apply to all Fellows and to anyone who acts for Azubi. A Host
        Organisation&rsquo;s own safeguarding policy applies at its premises and in its work. Where the two conflict, the stricter
        standard applies.
      </p>
      <p>1.3 Fellows must:</p>
      <p className="pl-[20px]">(a) treat everyone with dignity and respect;</p>
      <p className="pl-[20px]">
        (b) not engage in any sexual activity or relationship with a child or a person at risk, or with any person they supervise or who
        depends on them through the Fellowship;
      </p>
      <p className="pl-[20px]">(c) not use their position to obtain personal favours or exploit anyone;</p>
      <p className="pl-[20px]">
        (d) not take photographs or recordings of clients, children or vulnerable people without written consent and the Host
        Organisation&rsquo;s approval; and
      </p>
      <p className="pl-[20px]">(e) report any safeguarding concern as set out in paragraph 1.5.</p>
      <p>
        1.4 <strong>Vulnerable persons.</strong> Fellows must not undertake work that involves direct contact with a child or vulnerable
        adult unless the Host Organisation has approved it in writing and a suitable Supervisor is present.
      </p>
      <p>1.5 Anyone who has a safeguarding concern should report it to:</p>
      <p className="pl-[20px]">
        (a) the Host Organisation&rsquo;s designated safeguarding lead, where the concern arises in a placement;
      </p>
      <p className="pl-[20px]">
        (b) Azubi at <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>, marked &ldquo;Safeguarding&rdquo;; or
      </p>
      <p className="pl-[20px]">(c) if the concern involves a risk of serious harm, the police or other emergency services immediately.</p>
      <p>
        1.6 <strong>Response.</strong> We will record every safeguarding concern, act promptly and, where required, refer it to the
        relevant authority. We will not tolerate retaliation against anyone who raises a concern in good faith.
      </p>
      <p>
        1.7 <strong>Breach.</strong> A breach of this section is serious misconduct and may lead to immediate termination of the
        Fellowship and referral to the relevant authorities.
      </p>

      <h2 id="schedule-complaints">2. Complaints</h2>
      <p>
        2.1 <strong>What is a complaint.</strong> A complaint is an expression of dissatisfaction about the Website, the application
        process, the Fellowship, a Fellow or Azubi itself.
      </p>
      <p>
        2.2 <strong>How to complain.</strong> Complaints may be made through the <Link href="/azubi/contact">contact form</Link>, or by
        writing to <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>, marked &ldquo;Complaint&rdquo;. Please include
        your name, your relationship to the Fellowship, the facts, and what you would like us to do.
      </p>
      <p>2.3 Our process:</p>
      <p className="pl-[20px]">
        (a) <strong>Acknowledgement:</strong> within 5 working days.
      </p>
      <p className="pl-[20px]">
        (b) <strong>Review:</strong> a person who was not involved in the matter reviews it.
      </p>
      <p className="pl-[20px]">
        (c) <strong>Response:</strong> a written response, normally within 30 days of the complaint, setting out our findings and any
        action taken.
      </p>
      <p className="pl-[20px]">
        (d) <strong>Reconsideration:</strong> if you are not satisfied with our response, you may ask us in writing to review it again,
        and we will consider that request.
      </p>
      <p>
        2.4 Complaints about personal information may also be made to the Nigeria Data Protection Commission.
      </p>
      <p>
        2.5 <strong>Fair treatment.</strong> Complaints are handled confidentially, so far as is possible. Nobody will be penalised for
        making a complaint in good faith. Complaints made in bad faith, including false or malicious claims, may be dealt with under
        clause 14 of the Terms.
      </p>

      <h2 id="schedule-conflicts">3. Conflicts of interest</h2>
      <p>
        3.1 <strong>Definition.</strong> A conflict of interest exists where a personal, financial, professional or family interest
        could influence, or appear to influence, a Fellow&rsquo;s judgement or actions in the Fellowship.
      </p>
      <p>
        3.2 <strong>Declaration.</strong> Applicants and Fellows must declare, in writing, any actual or potential conflict on
        application, on acceptance and whenever a conflict arises. Common examples include:
      </p>
      <p className="pl-[20px]">
        (a) a family member, close friend or business partner who works for a Host Organisation, court, regulator or client;
      </p>
      <p className="pl-[20px]">(b) a financial interest in a Host Organisation or its clients;</p>
      <p className="pl-[20px]">
        (c) a matter in which the Fellow, or a close connection, is a party, witness or interested person; and
      </p>
      <p className="pl-[20px]">(d) employment or a role elsewhere that overlaps with placement work.</p>
      <p>3.3 Where a conflict is declared, we will decide, after review, whether to:</p>
      <p className="pl-[20px]">(a) allow the Fellow to continue with safeguards in place;</p>
      <p className="pl-[20px]">(b) restrict the Fellow from certain matters or Host Organisations; or</p>
      <p className="pl-[20px]">(c) end or defer the placement.</p>
      <p>
        3.4 <strong>Matters that must not be taken.</strong> Fellows must not take on work in any matter where they have a conflict that
        has not been cleared under paragraph 3.3, or where acting would breach a professional duty.
      </p>
      <p>
        3.5 <strong>Gifts and benefits.</strong> Fellows must not accept gifts or benefits from Host Organisations, clients or
        applicants that could appear to influence them. Any gift that is more than of trivial value must be declared.
      </p>
      <p>
        3.6 <strong>Confidentiality of conflicts.</strong> Declarations are kept confidential and used only to manage the conflict.
      </p>

      <h2 id="schedule-harassment">4. Anti-harassment and discrimination</h2>
      <p>
        4.1 <strong>Commitment.</strong> Azubi is committed to a workplace and programme free from harassment, bullying, sexual
        harassment, victimisation and discrimination. This includes discrimination based on sex, gender, religion, ethnicity,
        disability, age, marital or family status, or any other characteristic protected under Nigerian law.
      </p>
      <p>4.2 Prohibited conduct includes:</p>
      <p className="pl-[20px]">(a) unwanted physical, verbal or written conduct of a sexual nature;</p>
      <p className="pl-[20px]">(b) unwelcome comments, jokes or images that demean a person or group;</p>
      <p className="pl-[20px]">
        (c) repeated unreasonable behaviour that intimidates, humiliates or undermines someone;
      </p>
      <p className="pl-[20px]">
        (d) requests for sexual favours or any other favour in return for a benefit or to avoid a detriment; and
      </p>
      <p className="pl-[20px]">(e) retaliation against someone who has made or supported a complaint in good faith.</p>
      <p>
        4.3 <strong>Reasonable adjustments.</strong> Applicants and Fellows with disabilities or other needs may ask for reasonable
        adjustments in the application process and the Fellowship. Requests will be handled confidentially.
      </p>
      <p>
        4.4 <strong>Reporting.</strong> Harassment or discrimination may be reported using the complaints process in section 2 of this
        Schedule, or directly to <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>, marked &ldquo;Harassment&rdquo;.
        Reports involving a serious criminal offence may also be made to the police.
      </p>
      <p>
        4.5 <strong>Investigation.</strong> We will look into reports promptly and fairly, give the person accused a chance to respond,
        and take action proportionate to the findings. Interim measures, such as separating the people involved, may be used while an
        investigation is ongoing.
      </p>
      <p>
        4.6 <strong>Consequences.</strong> Breach of this section may lead to immediate termination of the Fellowship, and we may refer
        the matter to the relevant authorities or Host Organisation.
      </p>
      <p>
        4.7 <strong>Legal framework.</strong> This section supports, and does not replace, the Constitution of the Federal Republic of
        Nigeria, the Violence Against Persons (Prohibition) Act 2015, the Labour Act and applicable state laws.
      </p>

      <h2 id="schedule-review">5. Review</h2>
      <p>5.1 We will review this Schedule at least every 12 months, and after any serious incident or change in law.</p>
    </AzubiLegalPage>
  );
}
