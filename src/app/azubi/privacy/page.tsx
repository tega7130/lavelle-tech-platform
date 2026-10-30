import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiLegalPage } from "@/components/azubi/azubi-legal-page";

export const metadata: Metadata = azubiMetadata(
  "/azubi/privacy",
  "Privacy notice",
  "How Azubi Foundation collects, uses and protects your information."
);

const TOC = [
  { id: "who", label: "1. Who we are" },
  { id: "who-for", label: "2. Who this notice is for" },
  { id: "collect", label: "3. What we collect" },
  { id: "verification", label: "4. Verification of your status" },
  { id: "use", label: "5. How we use your information" },
  { id: "basis", label: "6. Our legal basis" },
  { id: "share", label: "7. Who we share it with" },
  { id: "transfer", label: "8. Storing information outside Nigeria" },
  { id: "keep", label: "9. How long we keep it" },
  { id: "secure", label: "10. Keeping it safe" },
  { id: "rights", label: "11. Your rights" },
  { id: "cookies", label: "12. Cookies" },
  { id: "children", label: "13. Children" },
  { id: "changes", label: "14. Changes to this notice" },
  { id: "contact", label: "15. Contact" },
];

export default function AzubiPrivacyPage() {
  return (
    <AzubiLegalPage
      kicker="Azubi Foundation"
      title="Privacy notice"
      lead="How Azubi Foundation collects, uses and protects your information."
      lastUpdated="30 October 2026"
      toc={TOC}
    >
      <p>
        This notice explains how Azubi Foundation (&ldquo;Azubi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;)
        collects, uses, shares and protects personal information when you use the Azubi website at{" "}
        <Link href="/azubi">learnlavelle.com/azubi</Link> (the &ldquo;Website&rdquo;) or apply to the Azubi fellowship (the
        &ldquo;Fellowship&rdquo;). It forms part of our <Link href="/azubi/terms">Terms of Use</Link>.
      </p>

      <h2 id="who">1. Who we are</h2>
      <p>
        Azubi Foundation is a non-profit organisation established by Lavelle Development Technologies Limited. Azubi Foundation is
        the controller of the personal information described in this notice. This means we decide why and how it is used.
      </p>
      <p>
        For any question about this notice or your information, write to <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>.
      </p>

      <h2 id="who-for">2. Who this notice is for</h2>
      <p>
        The Website and the Fellowship are for people aged 18 years and above only. We do not knowingly collect personal information
        from anyone under 18. If we learn that we have collected information from someone under 18, we will delete it.
      </p>

      <h2 id="collect">3. What we collect</h2>
      <p>We collect only what you choose to give us through our forms, plus basic technical information.</p>
      <ul>
        <li>
          <b>Application form:</b> your name, email address, phone number, country and state of residence, current status, the
          university or law school you attended, how you would like to work, the areas of law you want exposure to, and your written
          statement.
        </li>
        <li>
          <b>Verification:</b> if you are shortlisted, we may ask you to provide documents that show you are a law student, law
          graduate or lawyer. These are described in section 4 below.
        </li>
        <li>
          <b>Contact form:</b> your name, email address, phone number, organisation (optional), who you are writing as, and your
          message.
        </li>
        <li>
          <b>Technical information:</b> such as your browser and device type, which our hosting provider receives when you visit the
          Website.
        </li>
      </ul>
      <p>
        Please do not send documents, identification numbers or details of any legal matter through the application or contact forms.
        If you are shortlisted, we will tell you how to confirm your status and exactly how to provide verification documents.
      </p>

      <h2 id="verification">4. Verification of your status</h2>
      <p>
        4.1 <b>Why we verify.</b> We need to confirm that applicants are law students, law graduates or lawyers, so that we can match
        Fellows with suitable Host Organisations. We also use verification to confirm that applicants are 18 or over.
      </p>
      <p>
        4.2 <b>How we collect it.</b> We only ask for verification documents once you have been shortlisted, and only through a
        channel we have told you about directly. We will not ask for them before you are shortlisted, and you should not send them
        through the application or contact forms.
      </p>
      <p>
        4.3 <b>What we accept.</b> You will be asked for documents that show your status, for example:
      </p>
      <ul>
        <li>a current student identity card or enrolment letter from your university or law school;</li>
        <li>a graduation certificate or transcript showing your law degree; or</li>
        <li>evidence of your call to the Nigerian Bar or your enrolment as a legal practitioner.</li>
      </ul>
      <p>
        Where we need to confirm your identity, we may ask for a government-issued photo identification. We do not require your
        international passport, and we do not ask for your National Identification Number (NIN).
      </p>
      <p>
        4.4 <b>Minimise what you send.</b> You may cover or remove information that we do not need to verify your status, such as your
        passport number, date of birth or home address, from copies of your documents. Only the information needed to confirm your
        status is kept.
      </p>
      <p>4.5 We use these documents only to:</p>
      <p className="pl-[20px]">(a) confirm that you are a law student, law graduate or lawyer;</p>
      <p className="pl-[20px]">(b) confirm that you are 18 or over; and</p>
      <p className="pl-[20px]">
        (c) match you with registered Host Organisations, which may include law firms, legal departments, courts, non-governmental
        organisations and other registered legal host organisations.
      </p>
      <p>
        4.6 <b>Sharing with Host Organisations.</b> We share with a Host Organisation only the information that shows your verified
        status and the information needed to arrange a placement. We do not share your verification documents unless you agree, and
        then only the documents needed for that placement.
      </p>
      <p>
        4.7 <b>Keeping verification documents.</b> We keep verification documents only as long as needed to complete verification and
        make a matching decision. Once verification is complete, we delete the documents and keep a record that your status was
        verified and the date on which it was checked. That record is kept for the period set out in section 9.
      </p>

      <h2 id="use">5. How we use your information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>review applications and contact applicants;</li>
        <li>verify your status as set out in section 4;</li>
        <li>confirm the status of shortlisted applicants;</li>
        <li>match Fellows with Host Organisations;</li>
        <li>reply to messages from Fellows, Host Organisations and others;</li>
        <li>run, review and improve the Fellowship; and</li>
        <li>meet our legal obligations.</li>
      </ul>
      <p>We do not make decisions about you by automated means without a person reviewing the outcome.</p>

      <h2 id="basis">6. Our legal basis</h2>
      <p>
        We rely on your consent, which you give when you tick the relevant box on our forms. You can withdraw your consent at any time
        by writing to <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>. Withdrawing consent does not affect anything
        we did before you withdrew it. If you withdraw consent to verification, we cannot complete your application for matching.
      </p>
      <p>
        Where needed, we also rely on our legitimate interests in running the Fellowship responsibly and safely, and on our legal
        obligations.
      </p>

      <h2 id="share">7. Who we share it with</h2>
      <p>
        <b>Host Organisations.</b> If you are matched with a Host Organisation, we share the information described in section 4.6. We
        will tell you before this happens.
      </p>
      <p>
        <b>Service providers.</b> We use service providers who host the Website and process information on our behalf. They may only
        use your information to provide their service to us, and they must protect it under a written agreement.
      </p>
      <p>
        <b>Legal requirements.</b> We may disclose information where the law requires it, or where it is needed to protect
        people&rsquo;s safety or to respond to a lawful request.
      </p>
      <p>We do not sell personal information, and we do not share it for advertising.</p>

      <h2 id="transfer">8. Storing information outside Nigeria</h2>
      <p>
        Some of our service providers may store information outside Nigeria. Where this happens, we make sure your information is
        protected to the standard required by the Nigeria Data Protection Act 2023 (&ldquo;NDPA&rdquo;).
      </p>

      <h2 id="keep">9. How long we keep it</h2>
      <p>
        We keep your personal information for six years from the date of your last interaction with us. This applies to applications,
        Fellowship records, verification records, messages and other information. Verification documents are deleted earlier, as
        described in section 4.7. At the end of the period, we delete or anonymise the information, unless the law requires us to
        keep it for longer.
      </p>

      <h2 id="secure">10. Keeping it safe</h2>
      <p>
        We use reasonable technical and organisational measures to protect the information you give us, and we limit access to those
        who need it. Verification documents are stored separately from application information and are accessible only to staff who
        verify applicants. No online service is completely secure, so we cannot promise absolute security. If we become aware of a
        personal data breach that puts your rights at risk, we will tell you and the Nigeria Data Protection Commission as the NDPA
        requires.
      </p>

      <h2 id="rights">11. Your rights</h2>
      <p>Under the NDPA, you have the right to:</p>
      <ul>
        <li>ask us for access to your personal information;</li>
        <li>ask us to correct it;</li>
        <li>ask us to delete it;</li>
        <li>ask us to restrict or object to how we use it;</li>
        <li>receive a copy of it in a portable format; and</li>
        <li>withdraw your consent at any time.</li>
      </ul>
      <p>
        To use any of these rights, contact us through the <Link href="/azubi/contact">contact form</Link> or write to{" "}
        <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>. We will respond within the time the NDPA requires.
      </p>
      <p>If you are unhappy with how we have handled your information, you may complain to the Nigeria Data Protection Commission.</p>

      <h2 id="cookies">12. Cookies</h2>
      <p>Cookies are small files stored on your device. We use two kinds:</p>
      <p>
        <b>Essential cookies</b> keep the Website working. For example, they remember your choice about cookies and help the forms
        work. We set these without asking, because the Website cannot work properly without them.
      </p>
      <p>
        <b>Optional cookies</b> help us understand how the Website is used. We set these only if you accept them on our cookie banner.
        If you choose &ldquo;Essential only&rdquo;, we will not set optional cookies.
      </p>
      <p>
        You can change your choice at any time through the cookie settings on the Website. You can also clear or block cookies in your
        browser settings. Blocking essential cookies may stop parts of the Website, including our forms, from working.
      </p>

      <h2 id="children">13. Children</h2>
      <p>
        The Website and the Fellowship are for people aged 18 years and above only. This notice does not apply to children, and we do
        not direct the Website at them.
      </p>

      <h2 id="changes">14. Changes to this notice</h2>
      <p>
        We may update this notice from time to time. The date at the top of this page shows when it was last changed. If a change is
        material, we will tell you on the Website before it takes effect. Our <Link href="/azubi/terms">Terms of Use</Link> explain the
        rules for using the Website.
      </p>

      <h2 id="contact">15. Contact</h2>
      <p>
        For any question about this notice or your personal information, write to{" "}
        <a href="mailto:legal@learnlavelle.com">legal@learnlavelle.com</a>, or use the <Link href="/azubi/contact">contact form</Link>{" "}
        on the Website.
      </p>
    </AzubiLegalPage>
  );
}
