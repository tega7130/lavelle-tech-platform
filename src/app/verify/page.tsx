import type { Metadata } from "next";
import { VerifyPortal } from "@/components/verify/verify-portal";
import { SITE_URL } from "@/lib/site-url";

const PAGE_TITLE = "Verify a Credential | Lavelle Institute";
const PAGE_DESCRIPTION =
  "Confirm whether a Lavelle Institute credential is genuine using a candidate number — free, public, and requires no account.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/verify` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/verify`,
    siteName: "Lavelle Institute",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

// Deliberately outside /portal and /admin — this must render for a
// stranger with no account, no cookie and no context. No layout here
// requires a session; proxy.ts's matcher doesn't even cover this path.
export default async function Page({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  return <VerifyPortal initialNumber={number ?? ""} />;
}
