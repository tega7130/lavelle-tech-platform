import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

/** Builds page metadata in the same shape used site-wide (see src/app/contact/page.tsx). */
export function azubiMetadata(path: string, title: string, description: string): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title: `${title} | Azubi Foundation`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Azubi Foundation`,
      description,
      url,
      siteName: "Azubi Foundation",
      type: "website",
    },
    twitter: { card: "summary_large_image" },
  };
}
