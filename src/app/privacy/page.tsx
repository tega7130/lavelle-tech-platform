import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { SITE_URL, SITE_HOST } from "@/lib/site-url";

const PAGE_TITLE = "Privacy Policy | Lavelle Institute";
const PAGE_DESCRIPTION =
  "How Lavelle Professional Development Limited collects, uses, and protects your personal data across the platform, in compliance with the Nigeria Data Protection Act 2023.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/privacy`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const RETENTION_TABLE = [
  { type: "Account registration & profile data", period: "As long as your account is active, plus 3 years after closure (for legal/audit purposes)" },
  { type: "Payment & transaction records", period: "7 years (tax and legal compliance — FIRS requirement)" },
  { type: "Examination responses & assessment data", period: "7 years (credential verification and dispute resolution)" },
  { type: "Credential records", period: "Indefinite, to maintain the public verification service; revoked credentials retained for audit trail" },
  { type: "Usage logs & analytics", period: "12 months (after anonymisation)" },
  { type: "Customer support communications", period: "3 years" },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="13 September 2026">
      <p>
        Lavelle Professional Development Limited (&ldquo;Lavelle&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;,
        &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use,
        process, share, and protect your personal data when you use our platform at {SITE_HOST} (the
        &ldquo;Platform&rdquo;), enrol in programmes, purchase templates, take examinations, or interact with our
        services.
      </p>
      <p>
        This Privacy Policy is incorporated by reference into our <a href="/terms">Terms of Use</a>. If there is any
        conflict between this Privacy Policy and the Terms of Use regarding data protection matters, this Privacy
        Policy takes precedence.
      </p>
      <p>
        This Privacy Policy complies with the Nigeria Data Protection Act 2023 and applies to all personal data we
        collect from residents of Nigeria and anyone using the Platform.
      </p>

      <h2>1. Definitions</h2>
      <p>
        <strong>Personal data</strong> means any information relating to an identified or identifiable natural
        person (a data subject). This includes your name, email address, phone number, payment information,
        educational history, examination results, credentials, IP address, and any other information that can
        directly or indirectly identify you.
      </p>
      <p>
        <strong>Processing</strong> means any operation performed on personal data, including collection, recording,
        organisation, structuring, storage, adaptation, retrieval, consultation, use, disclosure, transmission,
        erasure, or destruction.
      </p>
      <p><strong>Data subject</strong> means you — the person whose personal data is being processed.</p>
      <p>
        <strong>Data controller</strong> means Lavelle Professional Development Limited — the entity that determines
        the purposes and means of processing personal data.
      </p>
      <p>
        <strong>Data processor</strong> means a person or organisation that processes personal data on behalf of the
        controller (e.g. our hosting provider, payment processor).
      </p>

      <h2>2. What personal data we collect</h2>
      <h3>2.1 Information you provide directly</h3>
      <p>When you register for an account, enrol in a programme, purchase templates, or interact with our Platform, you may provide:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Date of birth (if required for eligibility verification)</li>
        <li>Professional qualification or title (e.g. Barrister, Solicitor, In-house Counsel)</li>
        <li>Years of experience in the legal profession</li>
        <li>Organisation/employer name</li>
        <li>Payment information (card/bank details — processed by our third-party payment platform, not stored by Lavelle)</li>
        <li>Examination responses and assessment submissions</li>
        <li>Blog comments, messages, or feedback</li>
        <li>Any other information you voluntarily provide</li>
      </ul>
      <h3>2.2 Information collected automatically</h3>
      <p>When you use the Platform, we automatically collect:</p>
      <ul>
        <li>Internet Protocol (IP) address</li>
        <li>Browser type and version</li>
        <li>Operating system</li>
        <li>Pages visited and time spent on each page</li>
        <li>Date and time of access</li>
        <li>Referrer URL</li>
        <li>Device information (type, model, identifier)</li>
        <li>Cookies and similar tracking technologies</li>
        <li>Engagement metrics (e.g. course modules accessed, videos watched)</li>
      </ul>
      <p>
        We use cookies and similar technologies to improve your experience, remember your preferences, and
        understand how you use the Platform. You can control cookie settings through the banner shown on your first
        visit or through your browser; disabling cookies may affect Platform functionality.
      </p>
      <h3>2.3 Information from third parties</h3>
      <p>We may receive personal data from:</p>
      <ul>
        <li>Our payment processor (transaction details, payment status)</li>
        <li>Third-party identity verification services (if you voluntarily use them to verify your professional credentials)</li>
        <li>Your employer or organisation (if they enrol you in a group programme)</li>
        <li>Social media platforms (if you log in via single sign-on)</li>
        <li>Publicly available sources (e.g. professional registers, online directories — to verify eligibility or credential claims)</li>
      </ul>
      <p>
        We will inform you if personal data about you is collected from sources other than you directly, unless an
        exception applies under the Nigeria Data Protection Act 2023.
      </p>

      <h2>3. Legal basis for processing</h2>
      <h3>3.1 Consent</h3>
      <p>
        For non-essential processing (e.g. marketing communications, certain analytics), we rely on your explicit,
        informed consent. You can withdraw consent at any time by emailing{" "}
        <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>.
      </p>
      <h3>3.2 Contract performance</h3>
      <p>We process personal data necessary to fulfil our Terms of Use and deliver our services to you, including:</p>
      <ul>
        <li>Creating and managing your account</li>
        <li>Processing your enrolment and payments</li>
        <li>Delivering course content and examinations</li>
        <li>Issuing and verifying credentials</li>
        <li>Communicating with you about your account and programmes</li>
      </ul>
      <h3>3.3 Legal obligation</h3>
      <p>We may process personal data to comply with applicable laws, regulations, or court orders, including:</p>
      <ul>
        <li>Tax reporting to the Federal Inland Revenue Service (FIRS)</li>
        <li>Anti-money laundering (AML) and know-your-customer (KYC) obligations</li>
        <li>Fraud detection and prevention</li>
        <li>Responding to lawful requests from government or law enforcement</li>
      </ul>
      <h3>3.4 Legitimate interests</h3>
      <p>We may process personal data for our legitimate business interests, balanced against your rights, including:</p>
      <ul>
        <li>Improving Platform functionality and user experience</li>
        <li>Detecting and preventing fraud, abuse, or security threats</li>
        <li>Conducting anonymised analytics and research</li>
        <li>Enforcing our Terms of Use</li>
        <li>Protecting our legal rights and those of other users</li>
        <li>Aggregated, anonymised reporting to understand market trends</li>
      </ul>

      <h2>4. How we use your personal data</h2>
      <h3>4.1 Account and service delivery</h3>
      <ul>
        <li>Create, maintain, and authenticate your account</li>
        <li>Process payments and manage billing</li>
        <li>Deliver course content, examinations, and assessments</li>
        <li>Generate and issue credentials upon completion</li>
        <li>Send transactional emails (account updates, payment confirmations, course access links)</li>
      </ul>
      <h3>4.2 Communication</h3>
      <ul>
        <li>Respond to your enquiries and support requests</li>
        <li>Send programme updates, exam schedules, and grade notifications</li>
        <li>Send educational content and learning resources</li>
        <li>Send marketing and promotional communications (with your consent)</li>
        <li>Conduct surveys or collect feedback</li>
      </ul>
      <h3>4.3 Platform improvement and security</h3>
      <ul>
        <li>Monitor Platform performance and uptime</li>
        <li>Analyse user behaviour and engagement (anonymised)</li>
        <li>Detect, investigate, and prevent fraud, abuse, or security breaches</li>
        <li>Enforce the Terms of Use and this Privacy Policy</li>
        <li>Conduct security testing and vulnerability assessments</li>
      </ul>
      <h3>4.4 Legal and compliance</h3>
      <ul>
        <li>Comply with tax, AML, KYC, and anti-fraud regulations</li>
        <li>Respond to lawful requests from regulators or law enforcement</li>
        <li>Protect the rights, safety, and property of Lavelle, our users, and the public</li>
        <li>Establish, exercise, or defend legal claims</li>
      </ul>
      <h3>4.5 What we do not do</h3>
      <ul>
        <li>We do not sell or rent your personal data to third parties for marketing purposes</li>
        <li>We do not use your data to make automated decisions that significantly affect you (e.g. automated credential denials) without human review</li>
        <li>We do not share examination responses or assessment data with external parties except as required by law</li>
      </ul>

      <h2>5. Data sharing and disclosure</h2>
      <h3>5.1 Third-party service providers</h3>
      <p>
        We share personal data with third-party service providers who process it on our behalf, subject to data
        processing agreements that comply with the Nigeria Data Protection Act 2023. These include:
      </p>
      <ul>
        <li>Payment processors (for payment processing only)</li>
        <li>Cloud hosting and storage providers (for secure data storage and Platform hosting)</li>
        <li>Email service providers (for transactional and marketing communications)</li>
        <li>Analytics providers (for anonymised usage analytics)</li>
        <li>Identity verification services (if you opt in)</li>
        <li>Customer support platforms</li>
      </ul>
      <h3>5.2 Public credential verification</h3>
      <p>
        When you earn a credential, your name, programme tier, grade, issue date, and credential status (including
        &ldquo;Revoked&rdquo; if applicable) are displayed publicly in our credential verification tool. This allows
        employers, regulators, and the public to verify your credential using your certificate number. This is a
        core feature of the Platform and does not require your separate consent.
      </p>
      <h3>5.3 Legal obligations and law enforcement</h3>
      <p>
        We may disclose personal data if required by law, court order, or a lawful request from a government or law
        enforcement agency (e.g. FIRS, EFCC, Nigerian Police, courts). We will notify you of such requests unless
        prohibited by law.
      </p>
      <h3>5.4 Business transfers</h3>
      <p>
        If Lavelle is acquired, merged, or sold, your personal data may be transferred as part of that transaction.
        We will notify you of any such change and any choices available to you.
      </p>
      <h3>5.5 Aggregated and anonymised data</h3>
      <p>
        We may use and share aggregated or anonymised data (data that cannot identify you) for analytics, reporting,
        marketing, and research purposes without restriction.
      </p>

      <h2>6. Data retention</h2>
      <p>We retain personal data only as long as necessary to fulfil the purposes for which it was collected, or as required by law.</p>
      <div className="overflow-x-auto my-6">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-divider">
              <th className="text-left py-2.5 pr-4 font-heading font-semibold">Data type</th>
              <th className="text-left py-2.5 font-heading font-semibold">Retention period</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_TABLE.map((row) => (
              <tr key={row.type} className="border-b border-divider">
                <td className="py-2.5 pr-4 align-top font-medium">{row.type}</td>
                <td className="py-2.5 align-top text-neutral-700">{row.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        When data is no longer needed, we securely delete or permanently anonymise it. Credential records (name,
        tier, grade) are retained indefinitely to support the public credential verification service, even after
        your account is closed.
      </p>

      <h2>7. Your rights as a data subject</h2>
      <h3>7.1 Right of access</h3>
      <p>You have the right to request a copy of all personal data we hold about you, in a clear, intelligible format. We will respond within 30 days.</p>
      <h3>7.2 Right to rectification</h3>
      <p>
        You have the right to correct inaccurate or incomplete personal data. You can update certain information
        (name, email, phone) directly in your account settings. For other corrections, contact{" "}
        <a href="mailto:registrar@learnlavelle.com">registrar@learnlavelle.com</a>.
      </p>
      <h3>7.3 Right to erasure (&ldquo;right to be forgotten&rdquo;)</h3>
      <p>
        You have the right to request erasure of your personal data, except where we are required to retain it by
        law or for legitimate purposes (e.g. tax compliance, fraud prevention, credential verification).
      </p>
      <h3>7.4 Right to restrict processing</h3>
      <p>
        You have the right to request that we restrict processing of your personal data — for example, pending
        verification of a dispute over its accuracy.
      </p>
      <h3>7.5 Right to data portability</h3>
      <p>
        You have the right to receive your personal data in a structured, commonly used, machine-readable format
        (e.g. CSV) and to transmit it to another controller, where technically feasible.
      </p>
      <h3>7.6 Right to object</h3>
      <p>
        You have the right to object to processing based on legitimate interests (e.g. marketing communications,
        analytics). We will cease processing unless we have compelling legitimate grounds.
      </p>
      <h3>7.7 Right to lodge a complaint</h3>
      <p>
        You have the right to lodge a complaint with the National Information Technology Development Agency
        (NITDA), Nigeria&rsquo;s supervisory authority for data protection, if you believe we have violated your
        rights.
      </p>
      <h3>7.8 How to exercise your rights</h3>
      <p>
        To exercise any of these rights, contact us at{" "}
        <a href="mailto:registrar@learnlavelle.com">registrar@learnlavelle.com</a> with the subject line &ldquo;Data
        Subject Request&rdquo; and specify which right you are exercising. We will respond within 30 days or inform
        you of any extension needed.
      </p>

      <h2>8. Data security</h2>
      <p>
        We implement industry-standard technical, organisational, and administrative measures to protect your
        personal data against unauthorised access, alteration, disclosure, or destruction, including:
      </p>
      <ul>
        <li>Encryption of data in transit (HTTPS/TLS) and at rest</li>
        <li>Secure cloud hosting with access controls and regular backups</li>
        <li>Staff training on data protection and confidentiality</li>
        <li>Regular security audits and vulnerability assessments</li>
        <li>Incident response procedures to address any data breaches</li>
        <li>Password hashing and authentication safeguards</li>
        <li>Restricted access to personal data (need-to-know basis only)</li>
      </ul>
      <p>
        No method of transmission over the internet or electronic storage is completely secure, and we cannot
        guarantee absolute security. If we discover a data breach that poses a risk to your rights or freedoms, we
        will notify you and NITDA without undue delay (within 72 hours where feasible) and describe the measures
        taken to mitigate harm.
      </p>

      <h2>9. International data transfers</h2>
      <p>
        Lavelle is based in Nigeria and stores personal data primarily within Nigeria. Where we transfer data
        outside Nigeria (e.g. for cloud hosting or third-party services), we do so only with appropriate safeguards,
        such as:
      </p>
      <ul>
        <li>Standard contractual clauses approved by NITDA</li>
        <li>Data processing agreements that ensure equivalent protection</li>
        <li>Your explicit consent, where required</li>
      </ul>

      <h2>10. Children&rsquo;s privacy</h2>
      <p>
        The Platform is intended for users aged 18 and older. We do not knowingly collect personal data from
        individuals under 18. If we become aware that we have collected data from a minor without appropriate
        consent, we will take steps to delete it promptly. If you believe we have collected data from a minor,
        contact <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>.
      </p>

      <h2>11. Third-party links and services</h2>
      <p>
        Our Platform may contain links to third-party websites, services, or applications. This Privacy Policy does
        not apply to those third parties, and we encourage you to review their own privacy policies before providing
        personal data.
      </p>

      <h2>12. Marketing and communications preferences</h2>
      <p>You can manage your marketing preferences and opt out at any time by:</p>
      <ul>
        <li>Clicking the &ldquo;Unsubscribe&rdquo; link in any marketing email</li>
        <li>Updating your communication preferences in your account settings</li>
        <li>Emailing <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a></li>
      </ul>
      <p>
        Transactional emails (account confirmations, exam notifications, payment receipts) will continue regardless
        of your marketing preferences, as they are necessary for account management.
      </p>

      <h2>13. Cookies and tracking technologies</h2>
      <p>We use cookies and similar tracking technologies to:</p>
      <ul>
        <li>Remember your login status and preferences</li>
        <li>Analyse Platform usage and engagement</li>
        <li>Provide personalised content and recommendations</li>
        <li>Prevent fraud and enhance security</li>
        <li>Measure the effectiveness of marketing campaigns</li>
      </ul>
      <p>
        You can control cookies through the banner shown on your first visit or through your browser settings.
        Blocking cookies may affect your ability to use certain Platform features. We do not use third-party
        tracking services that share data with external advertisers without your explicit consent.
      </p>

      <h2>14. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or
        applicable law. We will notify you of material changes by posting the revised policy on the Platform and
        updating the &ldquo;Last updated&rdquo; date. Continued use of the Platform after such updates constitutes
        acceptance of the revised policy.
      </p>

      <h2>15. Contact and Data Protection Officer</h2>
      <p>
        General enquiries: <a href="mailto:candidates@learnlavelle.com">candidates@learnlavelle.com</a>
        <br />
        Data protection and account issues: <a href="mailto:registrar@learnlavelle.com">registrar@learnlavelle.com</a>
      </p>
      <p>
        We aim to resolve any data protection concerns promptly. If you are dissatisfied with our response, you have
        the right to lodge a complaint with NITDA.
      </p>
    </LegalPage>
  );
}
