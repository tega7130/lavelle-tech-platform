import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

const PAGE_TITLE = "Create an Account | Lavelle Institute";
const PAGE_DESCRIPTION = "Register a free Lavelle Institute candidate account to enrol in programmes and purchase library templates.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/register` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/register`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
