import type { Metadata } from "next";
import Link from "next/link";
import { azubiMetadata } from "@/lib/azubi/metadata";
import { AzubiLegalPage } from "@/components/azubi/azubi-legal-page";
import { AzubiPlaceholder } from "@/components/azubi/azubi-placeholder";

export const metadata: Metadata = azubiMetadata(
  "/azubi/privacy",
  "Privacy notice",
  "How Azubi Foundation collects, uses and protects your information."
);

const TOC = [
  { id: "who", label: "1. Who we are" },
  { id: "collect", label: "2. What we collect" },
  { id: "use", label: "3. How we use your information" },
  { id: "basis", label: "4. Our legal basis" },
  { id: "share", label: "5. Who we share it with" },
  { id: "transfer", label: "6. Storing information outside Nigeria" },
  { id: "keep", label: "7. How long we keep it" },
  { id: "secure", label: "8. Keeping it safe" },
  { id: "rights", label: "9. Your rights" },
  { id: "cookies", label: "10. Cookies" },
  { id: "children", label: "11. Children" },
  { id: "changes", label: "12. Changes to this notice" },
  { id: "contact", label: "13. Contact" },
];

export default function AzubiPrivacyPage() {
  return (
    <AzubiLegalPage
      kicker="Azubi Foundation"
      title="Privacy notice"
      lead="How Azubi Foundation collects, uses and protects your information."
      lastUpdated={<AzubiPlaceholder k="privacyLastUpdated" />}
      toc={TOC}
    >
      <h2 id="who">1. Who we are</h2>
      <p>
        Azubi Foundation is a nonprofit initiative founded by the team behind Lavelle Development Technologies
        Limited. This website is hosted at learnlavelle.com/azubi.
      </p>
      <p>
        The organisation responsible for your personal information: <AzubiPlaceholder k="legalEntity" />
      </p>

      <h2 id="collect">2. What we collect</h2>
      <p>We collect only what you choose to give us through our forms, plus basic technical information.</p>
      <ul>
        <li>
          <b>Application form:</b> your name, email address, phone number, state of residence, current status, the
          university or law school you attended, how you would like to work, the areas of law you want exposure to,
          and your written statement.
        </li>
        <li>
          <b>Contact form:</b> your name, email address, organisation (optional), who you are writing as, and your
          message.
        </li>
        <li>
          <b>Technical information:</b> such as your browser and device type, which our hosting provider receives
          when you visit the site.
        </li>
      </ul>
      <p>
        <b>Please do not</b> upload documents, send ID numbers, or tell us the details of a legal matter through our
        forms. If you are shortlisted, we will tell you how to confirm your status.
      </p>

      <h2 id="use">3. How we use your information</h2>
      <ul>
        <li>To review applications and contact applicants.</li>
        <li>To confirm the status of shortlisted applicants.</li>
        <li>To match fellows with host organisations.</li>
        <li>To reply to messages from fellows, law firms, organisations and others.</li>
        <li>To run, review and improve the fellowship programme.</li>
        <li>To meet our legal obligations.</li>
      </ul>

      <h2 id="basis">4. Our legal basis</h2>
      <p>
        We rely on your consent, which you give when you tick the box on our forms. You can withdraw your consent at
        any time. In some cases we may also rely on our legitimate interests in running the programme, or on a legal
        obligation.
      </p>

      <h2 id="share">5. Who we share it with</h2>
      <p>
        If you are matched with a host organisation, we will share the information the host needs to arrange your
        placement. <AzubiPlaceholder k="hostDataSharing" />
      </p>
      <p>
        We also use service providers who host this website and process information on our behalf. We may disclose
        information where the law requires it. We do not sell personal information.
      </p>

      <h2 id="transfer">6. Storing information outside Nigeria</h2>
      <p>
        Our service providers may store information outside Nigeria. Where this happens, we will take steps to make
        sure your information is protected as the Nigeria Data Protection Act 2023 requires.{" "}
        <AzubiPlaceholder k="hostingLocations" />
      </p>

      <h2 id="keep">7. How long we keep it</h2>
      <p>
        We keep personal information only for as long as we need it for the purposes above.{" "}
        <AzubiPlaceholder k="retentionPeriods" />
      </p>

      <h2 id="secure">8. Keeping it safe</h2>
      <p>
        We use reasonable technical and organisational measures to protect the information you give us, and we limit
        who can see it. No online service is completely secure, so we cannot promise absolute security.
      </p>

      <h2 id="rights">9. Your rights</h2>
      <p>
        Under the Nigeria Data Protection Act 2023, you have the right to ask us for access to your information, to
        correct it, to delete it, to restrict or object to how we use it, to receive a copy in a portable format, and
        to withdraw your consent. To use any of these rights, <Link href="/azubi/contact">contact us</Link>.
      </p>
      <p>
        If you are unhappy with how we handle your information, you may complain to the Nigeria Data Protection
        Commission.
      </p>

      <h2 id="cookies">10. Cookies</h2>
      <p>
        Essential cookies keep this website working, for example by remembering your choice about cookies. We set
        optional cookies, such as those that help us understand how the site is used, only if you accept them. If
        you choose &ldquo;Essential only&rdquo;, we will not set optional cookies.
      </p>
      <p>
        You can also clear or block cookies in your browser settings. Blocking essential cookies may stop parts of
        the site, including our forms, from working. <AzubiPlaceholder k="cookieList" />
      </p>

      <h2 id="children">11. Children</h2>
      <p>The fellowship is for law students and graduates. This website is not directed at children.</p>

      <h2 id="changes">12. Changes to this notice</h2>
      <p>
        We may update this notice from time to time. The date at the top of the page shows when it was last changed.
        Our <Link href="/azubi/terms">Terms of use</Link> explain the rules for using this website.
      </p>

      <h2 id="contact">13. Contact</h2>
      <p>
        For any question about this notice or your information, <Link href="/azubi/contact">contact us</Link> through the
        form on our website.
      </p>
    </AzubiLegalPage>
  );
}
