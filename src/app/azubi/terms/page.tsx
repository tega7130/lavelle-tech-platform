import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiLegalPage } from "@/components/azubi/azubi-legal-page";
import { AzubiPlaceholder } from "@/components/azubi/azubi-placeholder";

export const metadata: Metadata = azubiMetadata(
  "/azubi/terms",
  "Terms of use",
  "The rules for using the Azubi Foundation website."
);

const TOC = [
  { id: "about", label: "1. About these terms" },
  { id: "advice", label: "2. No legal advice" },
  { id: "fellowship", label: "3. The fellowship and applications" },
  { id: "info", label: "4. The information you give us" },
  { id: "use", label: "5. Using the website" },
  { id: "ip", label: "6. Our content" },
  { id: "links", label: "7. Links to other websites" },
  { id: "avail", label: "8. Availability and changes" },
  { id: "liab", label: "9. Limits on our responsibility" },
  { id: "law", label: "10. Governing law" },
  { id: "changes", label: "11. Changes to these terms" },
  { id: "contact", label: "12. Contact" },
];

export default function AzubiTermsPage() {
  return (
    <AzubiLegalPage
      kicker="Azubi Foundation"
      title="Terms of use"
      lead="The rules for using the Azubi Foundation website."
      lastUpdated={<AzubiPlaceholder k="termsLastUpdated" />}
      toc={TOC}
    >
      <h2 id="about">1. About these terms</h2>
      <p>
        These terms cover your use of the Azubi Foundation website. Azubi Foundation is a nonprofit initiative
        founded by the team behind Lavelle Development Technologies Limited. By using this website, you agree to
        these terms. If you do not agree, please do not use it.
      </p>

      <h2 id="advice">2. No legal advice</h2>
      <p>
        Azubi Foundation is not a law firm. We do not provide legal advice through this website, and nothing on it
        creates a lawyer&ndash;client relationship. Please do not send details of a legal matter through our forms.
      </p>

      <h2 id="fellowship">3. The fellowship and applications</h2>
      <ul>
        <li>
          Applying does not guarantee a placement. Placement depends on host availability and on how well your
          interests fit an available host.
        </li>
        <li>
          Azubi does not pay fellows. Any stipend or support, such as transport, is decided by the host and
          confirmed before you start.
        </li>
        <li>The fellowship does not guarantee a job.</li>
        <li>
          We may ask you to confirm your status before a placement is arranged, and hosts and fellows may be asked
          to agree to a placement agreement.
        </li>
      </ul>
      <p>
        You can apply through the <Link href="/azubi/apply">application form</Link>.
      </p>

      <h2 id="info">4. The information you give us</h2>
      <p>
        Please make sure the information you give us is accurate and complete. We handle it as described in our{" "}
        <Link href="/azubi/privacy">Privacy notice</Link>.
      </p>

      <h2 id="use">5. Using the website</h2>
      <p>You agree not to:</p>
      <ul>
        <li>give false or misleading information, or pretend to be someone else;</li>
        <li>use the website in a way that is unlawful or could harm others;</li>
        <li>try to disrupt, overload or gain unauthorised access to the website or its systems;</li>
        <li>use automated tools to collect information from the website.</li>
      </ul>

      <h2 id="ip">6. Our content</h2>
      <p>
        The content of this website, including its text, design and branding, belongs to Azubi Foundation or its
        licensors. You may view it and share links to it, but you may not copy or reuse it without our written
        permission.
      </p>

      <h2 id="links">7. Links to other websites</h2>
      <p>This website may link to other websites. We do not control them and are not responsible for their content or practices.</p>

      <h2 id="avail">8. Availability and changes</h2>
      <p>We try to keep the website available and accurate, but we provide it as it is. We may change, pause or remove any part of it at any time.</p>

      <h2 id="liab">9. Limits on our responsibility</h2>
      <p>
        To the extent the law allows, Azubi Foundation is not liable for any loss that results from your use of this
        website or from relying on its content. Nothing in these terms limits any liability that cannot lawfully be
        limited.
      </p>

      <h2 id="law">10. Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. <AzubiPlaceholder k="governingLawCourts" />
      </p>

      <h2 id="changes">11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The date at the top of the page shows when they were last
        changed. By continuing to use the website after a change, you accept the updated terms.
      </p>

      <h2 id="contact">12. Contact</h2>
      <p>
        For any question about these terms, <Link href="/azubi/contact">contact us</Link> through the form on our website.
      </p>
    </AzubiLegalPage>
  );
}
