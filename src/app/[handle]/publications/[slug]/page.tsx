import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LawyerSiteFooter } from "@/components/site/lawyer-site-view";
import { renderMarkupToReact } from "@/lib/rich-text";
import { getPublishedLawyerArticle } from "@/lib/lawyer-website-reads";
import { SITE_URL } from "@/lib/site-url";
import { getColorThemeMeta, getFontPairingMeta } from "@/lib/lawyer-website-templates";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string; slug: string }> }): Promise<Metadata> {
  const { handle, slug } = await params;
  const article = await getPublishedLawyerArticle(handle, slug);
  if (!article) return {};

  const title = `${article.title} — ${article.authorDisplayName}`;
  return {
    title,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `${SITE_URL}/${handle}/publications/${slug}` },
    robots: { index: false, follow: false }, // see [handle]/page.tsx's generateMetadata — same open decision, same safe default
  };
}

export default async function LawyerArticlePage({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const article = await getPublishedLawyerArticle(handle, slug);
  if (!article) notFound();

  // No Lavelle header here either — same reasoning as [handle]/page.tsx.
  // Same theme CSS vars as LawyerSiteView, so an article page matches the
  // rest of the lawyer's own site rather than reverting to Lavelle's
  // brand colors/fonts.
  const colorTheme = getColorThemeMeta(article.colorThemeKey);
  const fontPairing = getFontPairingMeta(article.fontPairingKey);
  const themeVars = {
    "--lw-primary": colorTheme.primary,
    "--lw-accent": colorTheme.accent,
    "--lw-heading-font": fontPairing.headingFont,
    "--lw-body-font": fontPairing.bodyFont,
  } as React.CSSProperties;

  return (
    <main className="mx-auto max-w-[680px] px-4 py-10" style={{ ...themeVars, fontFamily: "var(--lw-body-font)" }}>
      <Link href={`/${handle}`} className="text-[13px] hover:underline" style={{ color: "var(--lw-accent)" }}>
        ← Back to {article.authorDisplayName}
      </Link>
      <h1
        className="font-semibold text-[26px] sm:text-[32px] leading-[1.2] mt-4 tracking-[-0.02em]"
        style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}
      >
        {article.title}
      </h1>
      <div className="text-[13px] text-neutral-500 mt-3">
        {article.authorDisplayName}
        {article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : ""}
      </div>
      <div className="mt-8 text-[15.5px] leading-[1.75] text-neutral-800 [&_p]:mt-0 [&_p]:mb-5 [&_ul]:mb-5 [&_ol]:mb-5 [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_strong]:font-semibold">
        {renderMarkupToReact(article.body)}
      </div>
      <LawyerSiteFooter displayName={article.authorDisplayName} />
    </main>
  );
}
