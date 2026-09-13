import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

const PAGE_TITLE = "Sign In | Lavelle Institute";
const PAGE_DESCRIPTION = "Sign in to your Lavelle Institute candidate account to continue a programme, check deadlines, or view your credentials.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/sign-in` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/sign-in`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
