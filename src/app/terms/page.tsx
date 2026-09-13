import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { SITE_URL, SITE_HOST } from "@/lib/site-url";

const PAGE_TITLE = "Terms of Use | Lavelle Institute";
const PAGE_DESCRIPTION =
  "The terms that govern use of Lavelle Professional Development Limited's platform — programmes, examinations, credentials, the document library, and public credential verification.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/terms`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function TermsOfUsePage() {
  return (
    <LegalPage title="Terms of Use" lastUpdated="13 September 2026">
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) govern your use of the Lavelle Professional Development Limited
        platform and services, accessible at {SITE_HOST} (the &ldquo;Platform&rdquo;). Lavelle Professional
        Development Limited (&ldquo;Lavelle&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a
        company incorporated under the laws of the Federal Republic of Nigeria.
      </p>
      <p>
        By registering for an account, accessing the Platform, enrolling in any programme, purchasing templates, or
        otherwise using our services, you agree to be bound by these Terms. If you do not agree, do not use the
        Platform.
      </p>
      <p>
        We may update these Terms at any time. Changes take effect when posted to the Platform, with a revised
        &ldquo;Last updated&rdquo; date. Continued use of the Platform after changes are posted means you accept the
        updated Terms. We recommend you review these Terms periodically.
      </p>

      <h2>1. Eligibility and account registration</h2>
      <h3>1.1 Who can use the Platform</h3>
      <p>The Platform is open to:</p>
      <ul>
        <li>Practising lawyers and legal professionals</li>
        <li>In-house counsel and corporate legal teams</li>
        <li>Law graduates and law students</li>
        <li>Non-lawyers working in regulated industries</li>
        <li>Any person aged 18 or older seeking to verify credentials publicly</li>
      </ul>
      <p>
        Certain programmes may have specific entry requirements (e.g. minimum qualification, years of experience).
        You must meet these requirements to enrol; if you do not, Lavelle may cancel your enrolment.
      </p>
      <h3>1.2 Account registration</h3>
      <p>
        To create an account, you must provide accurate, complete, and current information. You are responsible for
        maintaining the confidentiality of your login credentials and for all activity that occurs under your
        account. You must notify us immediately at <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>{" "}
        if you suspect unauthorised access to your account.
      </p>
      <p>
        Lavelle reserves the right to suspend or terminate accounts that use false information, violate these Terms,
        or engage in fraudulent conduct.
      </p>

      <h2>2. Programmes, tiers and enrolment</h2>
      <h3>2.1 Programme structure</h3>
      <p>Lavelle offers three programme tiers:</p>
      <ul>
        <li><strong>Foundation:</strong> entry-level professional development</li>
        <li><strong>Specialist:</strong> mid-career specialization in a legal domain</li>
        <li><strong>Advanced Practitioner:</strong> senior-level credential and expertise</li>
      </ul>
      <p>
        Each tier has its own duration, entry requirements, fee, and assessment structure. Details are displayed on
        the programme page before you enrol.
      </p>
      <h3>2.2 Browsing is free; enrolment requires payment</h3>
      <p>
        You can browse all programme content without creating an account or paying a fee. Enrolment (activation of
        course access) is only available after payment is confirmed and has cleared.
      </p>

      <h2>3. Payment and fees</h2>
      <h3>3.1 Payment processing</h3>
      <p>
        Payment for programme fees and template purchases is processed by a third-party payment platform. We do not
        store your card, bank account, or payment details; all payment data is handled by the payment platform in
        accordance with its privacy and security policies. By proceeding to checkout, you authorize that payment
        platform to process your payment.
      </p>
      <h3>3.2 Fees and pricing</h3>
      <p>
        All fees are shown at checkout before you confirm payment. Fees may be displayed in Nigerian Naira (NGN) or
        other currencies, depending on your payment method. Currency conversion rates, if applicable, are determined
        by the payment platform. Lavelle is not responsible for exchange rate fluctuations.
      </p>
      <h3>3.3 Instalment plans</h3>
      <p>
        Lavelle may offer instalment payment plans for selected programmes, at its sole discretion. Terms of
        instalment plans (frequency, interest, late fees, cancellation consequences) are communicated at the point
        of sale and are in addition to these Terms. Failure to complete all instalments may result in access
        suspension or account termination.
      </p>
      <h3>3.4 Refunds and cancellations</h3>
      <p>
        Lavelle reserves the right to set a refund policy on a case-by-case basis, or to establish a per-programme
        refund policy, at its sole discretion. As of the date of these Terms, a comprehensive refund policy has not
        yet been finalized. Possible approaches under consideration include: no refunds after enrolment, a 7-day
        money-back guarantee if no course materials have been accessed, a pro-rata refund if withdrawing before the
        course midpoint, or case-by-case review by the registrar. A revised version of this clause will be published
        as part of the finalized Terms before the refund policy is treated as settled. Any enrolment made before that
        happens is subject to the refund terms in force at the time of enrolment, which Lavelle will publish
        separately.
      </p>

      <h2>4. Examinations and assessment</h2>
      <h3>4.1 Examination structure</h3>
      <p>
        Examinations may include objective questions (multiple choice, true/false) and written responses.
        Examination schedules, formats, and grading criteria are provided during enrolment.
      </p>
      <h3>4.2 Retake policy</h3>
      <p>
        Candidates who do not achieve the required grade may be eligible to retake the examination. Retake
        eligibility, fees, and scheduling vary by programme and are communicated clearly at the time of initial
        examination results. A retake fee may apply.
      </p>
      <h3>4.3 Examination conduct and integrity</h3>
      <p>
        You must take examinations honestly and without cheating, plagiarism, impersonation, or use of unauthorized
        materials. Any breach of examination integrity will result in immediate examination cancellation, credential
        revocation, and possible account termination.
      </p>

      <h2>5. Certificates and credentials</h2>
      <h3>5.1 Issuance</h3>
      <p>
        A Lavelle certificate is issued only after you have completed all programme requirements (course modules,
        assessments, examinations) and achieved the required grade. The certificate includes:
      </p>
      <ul>
        <li>Your name</li>
        <li>Programme tier and name</li>
        <li>A unique certificate number</li>
        <li>Your grade (Distinction / Merit / Pass / Refer)</li>
        <li>Issue date</li>
      </ul>
      <p>You will receive a digital copy and may be issued a printed copy at Lavelle&rsquo;s discretion.</p>
      <h3>5.2 Credential confidentiality and misuse</h3>
      <p>
        You are responsible for protecting your certificate number and credentials. Do not share your certificate
        for others to use, or misrepresent it. Any use of a Lavelle credential to falsely represent yourself to an
        employer, regulator, or third party is fraud and grounds for immediate revocation.
      </p>
      <h3>5.3 Credential revocation</h3>
      <p>Lavelle may revoke a credential if it is discovered that:</p>
      <ul>
        <li>You did not meet eligibility or entry requirements at the time of enrolment</li>
        <li>You committed fraud, cheating, or examination misconduct</li>
        <li>You misrepresented yourself or your qualifications</li>
        <li>You materially breached these Terms or Lavelle&rsquo;s conduct standards</li>
        <li>You provided false information during registration or assessment</li>
      </ul>
      <p>
        Revocation is permanent. Once revoked, the credential is marked &ldquo;Revoked&rdquo; in the public
        verification tool and is no longer recognized by Lavelle.
      </p>

      <h2>6. Document template library and purchase</h2>
      <h3>6.1 Limited license</h3>
      <p>
        When you purchase a professional legal document template (e.g. an employment contract, memorandum of
        understanding, or commercial agreement), Lavelle grants you a personal-use license to download and use the
        template for your own professional purposes. This license is non-exclusive and non-transferable.
      </p>
      <h3>6.2 No resale or redistribution</h3>
      <p>
        You may not resell, redistribute, republish, or share purchased templates with third parties (clients,
        colleagues, or the public), and you may not use templates to create a competing product or service.
        Unauthorized resale or redistribution is a material breach of these Terms and may result in account
        termination and legal action.
      </p>
      <h3>6.3 Templates are drafting aids, not legal advice</h3>
      <p>
        Templates are provided as educational and practical drafting aids. They are not customized legal advice, and
        Lavelle does not provide legal representation when you purchase or use a template. You are responsible for
        reviewing, adapting, and securing professional legal counsel before using any template in a real
        transaction.
      </p>

      <h2>7. Intellectual property</h2>
      <h3>7.1 Lavelle ownership</h3>
      <p>
        All course content, curriculum, materials, branding, logos, examination questions, template designs, blog
        posts, and any other content on the Platform (&ldquo;Lavelle Content&rdquo;) are owned by Lavelle or licensed
        from third parties, and are protected by Nigerian copyright law and international copyright treaties.
      </p>
      <h3>7.2 Your limited license</h3>
      <p>
        Subject to your compliance with these Terms, Lavelle grants you a limited, non-exclusive, non-transferable
        license to access and use Lavelle Content for your own professional development only. You may not:
      </p>
      <ul>
        <li>Copy, modify, or create derivative works from Lavelle Content</li>
        <li>Distribute, sell, or sublicense Lavelle Content</li>
        <li>Reverse engineer, decompile, or extract data structures from the Platform</li>
        <li>Scrape, bulk download, or republish course materials or credential verification data</li>
        <li>Use Lavelle Content to create a competing educational platform or product</li>
      </ul>
      <h3>7.3 Your content</h3>
      <p>
        If you submit content to Lavelle (e.g. blog comments, messages, feedback), you grant Lavelle a non-exclusive,
        royalty-free license to use, modify, and display that content in connection with the Platform. You represent
        that you own or control all rights to any content you submit and that it does not infringe third-party
        rights.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to use the Platform in any manner that:</p>
      <ul>
        <li>Violates any applicable law, regulation, or third-party right</li>
        <li>Is fraudulent, deceptive, or involves identity theft or impersonation</li>
        <li>Violates these Terms or abuses the credential verification system</li>
        <li>Circumvents security measures or attempts to gain unauthorized access</li>
        <li>Disrupts the Platform or other users&rsquo; experience</li>
        <li>Scrapes or bulk-extracts verification data from the public credential tool</li>
        <li>Uses the Platform to harm, threaten, or harass others</li>
        <li>Spreads malware, viruses, or malicious code</li>
        <li>Is abusive, defamatory, obscene, or violates public order or decency</li>
        <li>Involves spam, unsolicited promotion, or commercial activity not authorized by Lavelle</li>
      </ul>
      <p>
        Violations may result in immediate suspension or termination of your account, revocation of credentials, and
        referral to law enforcement or relevant authorities.
      </p>

      <h2>9. Disclaimers</h2>
      <h3>9.1 &ldquo;As is&rdquo; provision</h3>
      <p>
        The Platform and all Lavelle Content are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        any warranty of any kind, express or implied, including warranties of merchantability, fitness for a
        particular purpose, or non-infringement.
      </p>
      <h3>9.2 No guaranteed outcomes</h3>
      <p>
        Lavelle makes no guarantee that completing a programme will lead to a promotion, salary increase, new job,
        improved client relationships, or any specific professional or career outcome. Programme completion and
        credentials are educational qualifications only, and Lavelle does not guarantee that employers or regulators
        will recognize or value Lavelle credentials.
      </p>
      <h3>9.3 No professional advice</h3>
      <p>
        Course content is educational. Nothing on the Platform constitutes legal, tax, or accounting advice for your
        specific situation. Lavelle is not your lawyer and does not create an attorney-client relationship.
      </p>
      <h3>9.4 Platform availability</h3>
      <p>
        Lavelle does not guarantee uninterrupted or error-free access to the Platform. The Platform may be
        unavailable for maintenance, updates, or circumstances beyond our control.
      </p>

      <h2>10. Limitation of liability</h2>
      <h3>10.1 Liability cap</h3>
      <p>
        To the maximum extent permitted by Nigerian law, Lavelle&rsquo;s total liability to you arising from your
        use of the Platform or these Terms shall not exceed the fees you paid to Lavelle in the 12 months preceding
        the claim.
      </p>
      <h3>10.2 Exclusion of consequential damages</h3>
      <p>
        To the maximum extent permitted by Nigerian law, Lavelle shall not be liable for indirect, incidental,
        special, consequential, punitive, or lost-profit damages, even if advised of the possibility of such
        damages.
      </p>
      <h3>10.3 Exceptions</h3>
      <p>
        These limitations do not apply to: (a) Lavelle&rsquo;s gross negligence or wilful misconduct, (b) violation
        of your statutory rights that cannot be excluded, or (c) claims for which Nigerian law does not permit
        limitation.
      </p>

      <h2>11. Suspension and termination</h2>
      <h3>11.1 Termination for cause</h3>
      <p>Lavelle may suspend or terminate your account immediately, without notice or refund, if you:</p>
      <ul>
        <li>Violate these Terms or any applicable law</li>
        <li>Engage in fraud, cheating, or misrepresentation</li>
        <li>Abuse the Platform, examination system, or credential verification tool</li>
        <li>Threaten, harass, or abuse Lavelle staff or other users</li>
        <li>Commit examination misconduct or credential fraud</li>
        <li>Fail to pay required fees</li>
      </ul>
      <h3>11.2 Termination for convenience</h3>
      <p>
        You may close your account at any time by emailing{" "}
        <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>. Upon termination, you lose
        access to course materials and cannot enrol in new programmes. Credential verification remains publicly
        available.
      </p>
      <h3>11.3 Effect of termination</h3>
      <p>
        Upon termination, your account access is revoked. Any credentials you have earned remain in the public
        verification system unless revoked. You remain bound by these Terms, including the confidentiality and
        intellectual property provisions.
      </p>

      <h2>12. Governing law and jurisdiction</h2>
      <p>
        These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflicts of law.
        You agree to submit to the exclusive jurisdiction of the courts of the Federal Republic of Nigeria for any
        dispute arising from or relating to these Terms or the Platform.
      </p>

      <h2>13. Privacy and data protection</h2>
      <p>
        Your use of the Platform is also governed by our separate{" "}
        <a href="/privacy">Privacy Policy</a>, which describes how we collect, use, process, and protect your
        personal data in compliance with the Nigeria Data Protection Act 2023. The Privacy Policy is incorporated by
        reference into these Terms; any conflict between the two on data protection matters is resolved in favour of
        the Privacy Policy.
      </p>

      <h2>14. Blog and public content</h2>
      <p>
        Lavelle publishes blog posts and articles on legal topics for educational and informational purposes only.
        Blog content does not constitute legal advice and is not a substitute for professional legal counsel.
        Reading or sharing blog content does not create an attorney-client relationship.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        Lavelle may update these Terms at any time by posting a revised version on the Platform with an updated
        &ldquo;Last updated&rdquo; date, and by sending notice of material changes to the email address associated
        with your account. Continued use of the Platform after changes are posted constitutes acceptance of the
        updated Terms. If you do not agree, you must stop using the Platform and contact us to close your account.
      </p>

      <h2>16. Severability</h2>
      <p>
        If any provision of these Terms is found invalid or unenforceable by a court, that provision shall be
        severed, and the remaining Terms shall remain in full force and effect to the maximum extent permitted by
        law.
      </p>

      <h2>17. Entire agreement</h2>
      <p>
        These Terms, together with our Privacy Policy, constitute the entire agreement between you and Lavelle with
        respect to your use of the Platform, and supersede all prior agreements, understandings, and negotiations,
        whether written or oral.
      </p>

      <h2>18. Your acknowledgement</h2>
      <p>By registering for an account, or by using the Platform, you acknowledge that:</p>
      <ul>
        <li>You have read these Terms</li>
        <li>You understand and agree to be bound by these Terms</li>
        <li>You are of legal age to enter into a binding contract</li>
        <li>You will use the Platform lawfully and in accordance with these Terms</li>
      </ul>

      <h2>19. Contact and support</h2>
      <p>
        General enquiries: <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>
        <br />
        Credential/account issues: <a href="mailto:registrar@learnlavelle.com">registrar@learnlavelle.com</a>
        <br />
        Address: Surulere, Lagos, Nigeria
      </p>
    </LegalPage>
  );
}
