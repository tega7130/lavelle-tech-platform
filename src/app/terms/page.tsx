import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { SITE_URL, SITE_HOST } from "@/lib/site-url";

const PAGE_TITLE = "Terms of Use | Lavelle Institute";
const PAGE_DESCRIPTION =
  "The terms that govern use of Lavelle Institute's website, candidate portal, programmes, document library, and credential verification service.";

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
    <LegalPage title="Terms of Use" lastUpdated="10 September 2026">
      <p>
        These terms govern your use of {SITE_HOST}, the Lavelle candidate portal, our programmes, our document
        template library, and our public credential verification service (together, the &ldquo;Services&rdquo;).
        By creating an account, enrolling in a programme, or purchasing a library template, you agree to these
        terms. If you do not agree, do not use the Services.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <p>
        You must provide accurate information when registering and keep your account credentials confidential.
        You are responsible for all activity that occurs under your account. Tell us immediately at{" "}
        <a href="mailto:registrar@lavelle.ng">registrar@lavelle.ng</a> if you suspect unauthorised access.
      </p>

      <h2>2. Programmes, enrolment, and cohorts</h2>
      <ul>
        <li>Enrolment is confirmed once payment is received and you are placed in a cohort or intake.</li>
        <li>Programme content, schedules, examiners, and cohort composition may be adjusted where reasonably necessary to deliver the programme.</li>
        <li>Assessment and examination rules (including retake policies, where offered) are set out in the materials provided to you at enrolment and form part of these terms.</li>
        <li>You are responsible for meeting attendance and assessment requirements needed to be awarded a credential.</li>
      </ul>

      <h2>3. Fees and payment</h2>
      <p>
        Fees are shown at checkout in the applicable currency and must be paid in full, or according to any
        instalment plan we expressly offer, before enrolment is confirmed. Payments are processed by a third-party
        payment provider; we are not responsible for outages or errors on their platform.
      </p>

      <h2>4. Refunds and cancellations</h2>
      <p>
        Our refund policy varies by programme and is stated at the point of purchase where applicable. If no
        refund terms are stated for a purchase, or you have a question about a specific transaction, contact{" "}
        <a href="mailto:candidates@lavelle.ng">candidates@lavelle.ng</a> and we will review it on a case-by-case
        basis.
      </p>

      <h2>5. Certificates and credential verification</h2>
      <p>
        Credentials are awarded only once all applicable programme and assessment requirements are met. Once
        issued, a credential&rsquo;s status (including any subsequent suspension or revocation) is discoverable
        through our public verification tool at /verify, using the candidate number. You may not alter, falsify,
        or misrepresent a Lavelle credential, or claim a credential you have not been awarded. We may revoke a
        credential obtained through fraud, misrepresentation, or a material breach of these terms.
      </p>

      <h2>6. Document library</h2>
      <p>
        Templates purchased through our library are licensed to you for your own use, including adaptation for
        your own matters. Purchasing a template does not transfer ownership of the underlying work, and you may
        not resell, redistribute, or publish our templates as your own product. Templates are provided as
        drafting aids and are not a substitute for independent legal advice on your specific circumstances.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Services for any unlawful purpose or in violation of any applicable regulation</li>
        <li>Attempt to gain unauthorised access to any account, system, or data</li>
        <li>Interfere with or disrupt the integrity or performance of the Services</li>
        <li>Scrape, copy, or redistribute programme content, library templates, or verification data in bulk</li>
        <li>Impersonate another person or misrepresent your affiliation with any person or organisation</li>
      </ul>

      <h2>8. Intellectual property</h2>
      <p>
        All programme materials, course content, branding, and site design are owned by Lavelle Institute or our
        licensors and are protected by applicable intellectual property law. Except for the limited licence granted
        for library templates under Section 6, no rights are granted to you beyond personal, non-commercial use
        of the Services for your own professional development.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Services are provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do not
        guarantee that the Services will be uninterrupted, error-free, or that completing a programme will result
        in any particular professional or career outcome.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Lavelle Institute is not liable for any indirect, incidental, or
        consequential damages arising from your use of the Services. Our total liability for any claim arising
        out of these terms is limited to the amount you paid us in the twelve months preceding the claim.
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend or terminate your account if you breach these terms, engage in fraud, or misuse the
        Services. You may stop using the Services at any time; this does not entitle you to a refund except as
        set out in Section 4.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The &ldquo;Last updated&rdquo; date above reflects the most
        recent revision. Continued use of the Services after a change takes effect constitutes acceptance of the
        revised terms.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria, and any dispute arising from them
        is subject to the exclusive jurisdiction of the courts of Nigeria.
      </p>

      <h2>14. Contact us</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a href="mailto:candidates@lavelle.ng">candidates@lavelle.ng</a>. Lavelle Institute, Lagos, Nigeria.
      </p>
    </LegalPage>
  );
}
