import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LawyerSiteView } from "@/components/site/lawyer-site-view";
import { getPublishedLawyerWebsiteByHandle } from "@/lib/lawyer-website-reads";
import { SITE_URL } from "@/lib/site-url";

// Plain SSR, deliberately not generateStaticParams/ISR like /blog — a
// lawyer's own site is actively edited by its one owner and gets modest
// individual traffic, the opposite shape from a small set of
// editorially-controlled, high-traffic marketing pages. Always-fresh on
// every request is the better fit here, not a shortcut.

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const site = await getPublishedLawyerWebsiteByHandle(handle);
  if (!site) return {};

  const title = `${site.displayName} — Lavelle`;
  const description = site.introText ?? site.biographyText ?? `${site.displayName}'s professional website on Lavelle.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${handle}` },
    // Defaulting to noindex until Lavelle explicitly decides search-engine
    // visibility for lawyer sites (requirements register, open item) —
    // reversible later with no downside; accidentally getting indexed
    // first is the harder one to undo.
    robots: { index: false, follow: false },
  };
}

export default async function LawyerWebsitePublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const site = await getPublishedLawyerWebsiteByHandle(handle);
  if (!site) notFound();

  // No Lavelle header or footer here, deliberately — a published lawyer
  // site is THEIR site, shared under THEIR name. The look of whatever
  // sits above this content is the template's job (Phase 5), not a
  // fixed institutional header; LawyerSiteView supplies the one footer
  // line this page gets (the lawyer's own name + a light Lavelle credit).
  return (
    <main>
      <LawyerSiteView {...site} />
    </main>
  );
}
