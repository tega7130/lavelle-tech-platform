import Link from "next/link";
import { Card, CardTitle, CardBody } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";

const QUICK_LINKS = [
  { href: "/portal/library/templates", title: "Browse All Templates", body: "Search and filter contracts, MOUs, agreements and other professional document templates." },
  { href: "/portal/library/purchases", title: "My Purchases", body: "Download or view templates you've already purchased." },
  { href: "/portal/library/favorites", title: "My Favorites", body: "Templates you've saved for later." },
];

export default function LibraryHomePage() {
  return (
    <div className="max-w-[900px]">
      <div className="mb-[var(--space-6)]">
        <div className="font-heading font-semibold text-[19px]">Document Library</div>
        <p className="mt-1.5 max-w-[64ch] text-[13px] text-neutral-600">
          Browse and access professional and legal document templates — contracts, MOUs, agreements, employment
          documents and more — prepared for candidates on the Lavelle platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="no-underline text-text">
            <Card elev="sm" className="h-full">
              <CardTitle>{link.title}</CardTitle>
              <CardBody>{link.body}</CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Link href="/portal/library/templates" className={buttonClassName("primary", "mt-[var(--space-6)]")}>
        Explore Templates
      </Link>
    </div>
  );
}
