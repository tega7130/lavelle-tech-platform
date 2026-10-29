import Link from "next/link";
import { renderMarkupToReact } from "@/lib/rich-text";
import { SITE_URL } from "@/lib/site-url";
import { getTemplateMeta, getColorThemeMeta, getFontPairingMeta } from "@/lib/lawyer-website-templates";

type SectionKey = "ABOUT" | "PRACTICE_AREAS" | "QUALIFICATIONS" | "EXPERIENCE" | "PUBLICATIONS" | "ACTIVITIES" | "SOCIAL_CONTACT" | "CV";

export interface LawyerSiteViewProps {
  handle: string;
  displayName: string;
  templateKey: string | null;
  colorThemeKey: string | null;
  fontPairingKey: string | null;
  sections: { sectionKey: SectionKey; isVisible: boolean }[];
  introText: string | null;
  biographyText: string | null;
  personalStatementText: string | null;
  careerJourneyText: string | null;
  personalInterestsText: string | null;
  practiceAreas: string[];
  qualifications: { id: string; source: string; title: string; issuer: string | null; year: number | null }[];
  experiences: { id: string; organisation: string; roleTitle: string; startYear: number; endYear: number | null; isCurrent: boolean; description: string | null }[];
  publications: { id: string; kind: string; title: string; externalUrl: string | null; excerpt: string | null; slug: string | null; isPublished: boolean }[];
  activities: { id: string; title: string; description: string | null; year: number | null }[];
  socialLinks: { platform: string; url: string }[];
  cvDownloadUrl: string | null;
  /** True only for the owner's own private preview — shows a banner so it's never mistaken for the real live page. */
  isPreview?: boolean;
}

function hasAboutContent(p: LawyerSiteViewProps) {
  return !!(p.introText || p.biographyText || p.personalStatementText || p.careerJourneyText || p.personalInterestsText);
}

const ABOUT_FIELDS: { key: keyof LawyerSiteViewProps; label: string }[] = [
  { key: "introText", label: "Introduction" },
  { key: "biographyText", label: "Biography" },
  { key: "personalStatementText", label: "Personal Statement" },
  { key: "careerJourneyText", label: "Career Journey" },
  { key: "personalInterestsText", label: "Personal Interests" },
];

/** The name heading's treatment per template — the one structural difference between templates right now (placeholder scaffolding; real template art will likely do more than this). */
function NameHeading({ displayName, templateKey }: { displayName: string; templateKey: string | null }) {
  const key = getTemplateMeta(templateKey).key;
  if (key === "classic") {
    return (
      <div className="text-center">
        <h1 className="font-semibold text-[28px] sm:text-[34px] tracking-[-0.02em]" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
          {displayName}
        </h1>
        <div className="mx-auto mt-4 w-16 border-t" style={{ borderColor: "var(--lw-accent)" }} />
      </div>
    );
  }
  if (key === "minimal") {
    return (
      <h1 className="font-medium text-[22px] sm:text-[26px] tracking-[-0.01em] mt-2" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
        {displayName}
      </h1>
    );
  }
  // modern (default)
  return (
    <h1
      className="font-semibold text-[28px] sm:text-[34px] tracking-[-0.02em] pb-3 border-b-4 inline-block"
      style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)", borderColor: "var(--lw-accent)" }}
    >
      {displayName}
    </h1>
  );
}

/**
 * Shared between the real public page and the owner's private preview —
 * same discipline as BlogPostView ("so a preview is exactly what goes
 * live, not a lookalike that can drift"). A section renders only when
 * it's BOTH visible AND actually has content — a hidden or empty section
 * never shows a "coming soon" placeholder (requirements register).
 *
 * Template/color/font are applied here via CSS custom properties on the
 * outer wrapper, not Tailwind's own `font-heading`/`text-accent` utility
 * classes — those are Lavelle's OWN brand tokens, and this is the
 * lawyer's site, not Lavelle's (see the register's header/footer note).
 * The one exception is the "Verified by Lavelle" badge and the preview
 * banner below — those are Lavelle's own trust/system chrome, not the
 * lawyer's content, so they deliberately stay on Lavelle's fixed accent
 * color regardless of the lawyer's chosen theme.
 */
export function LawyerSiteView(props: LawyerSiteViewProps) {
  const visible = new Map(props.sections.map((s) => [s.sectionKey, s.isVisible]));
  const colorTheme = getColorThemeMeta(props.colorThemeKey);
  const fontPairing = getFontPairingMeta(props.fontPairingKey);

  const themeVars = {
    "--lw-primary": colorTheme.primary,
    "--lw-accent": colorTheme.accent,
    "--lw-heading-font": fontPairing.headingFont,
    "--lw-body-font": fontPairing.bodyFont,
  } as React.CSSProperties;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10" style={{ ...themeVars, fontFamily: "var(--lw-body-font)" }}>
      {props.isPreview && (
        <div className="mb-6 rounded-md bg-accent-100 text-accent-700 text-[13px] px-3 py-2">
          This is a private preview — only you can see this. It will look exactly like this once published.
        </div>
      )}

      <NameHeading displayName={props.displayName} templateKey={props.templateKey} />

      {visible.get("ABOUT") && hasAboutContent(props) && (
        <section className="mt-8">
          {ABOUT_FIELDS.map(({ key, label }) => {
            const value = props[key];
            if (!value || typeof value !== "string") return null;
            return (
              <div key={label} className="mb-6">
                <h2 className="font-semibold text-[15px] mb-2" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
                  {label}
                </h2>
                <div className="text-[15px] leading-[1.7] text-neutral-800 [&_p]:mb-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6">
                  {renderMarkupToReact(value)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {visible.get("PRACTICE_AREAS") && props.practiceAreas.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Areas of Practice
          </h2>
          <div className="flex flex-wrap gap-2">
            {props.practiceAreas.map((area) => (
              <span key={area} className="rounded-full bg-neutral-100 px-3 py-1 text-[12px] font-medium text-neutral-700">
                {area}
              </span>
            ))}
          </div>
        </section>
      )}

      {visible.get("QUALIFICATIONS") && props.qualifications.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Qualifications
          </h2>
          <ul className="flex flex-col gap-2.5">
            {props.qualifications.map((q) => (
              <li key={q.id} className="flex items-baseline gap-2 text-[14px]">
                <span className="font-medium">{q.title}</span>
                {q.source === "LAVELLE_CERTIFICATE" ? (
                  <span className="rounded-full bg-accent-100 text-accent-700 text-[11px] font-medium px-2 py-0.5">Verified by Lavelle</span>
                ) : (
                  <span className="text-neutral-500">{[q.issuer, q.year].filter(Boolean).join(" · ")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.get("EXPERIENCE") && props.experiences.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Experience
          </h2>
          <ul className="flex flex-col gap-4">
            {props.experiences.map((e) => (
              <li key={e.id}>
                <div className="text-[14px] font-medium">
                  {e.roleTitle}, {e.organisation}
                </div>
                <div className="text-[12.5px] text-neutral-500 mb-1">
                  {e.startYear} – {e.isCurrent ? "Present" : e.endYear ?? ""}
                </div>
                {e.description && <div className="text-[14px] leading-[1.6] text-neutral-700">{renderMarkupToReact(e.description)}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.get("PUBLICATIONS") && props.publications.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Publications
          </h2>
          <ul className="flex flex-col gap-2.5">
            {props.publications.map((p) => (
              <li key={p.id} className="text-[14px]">
                {p.kind === "NATIVE_ARTICLE" && p.slug ? (
                  <Link href={`/${props.handle}/publications/${p.slug}`} className="hover:underline font-medium" style={{ color: "var(--lw-accent)" }}>
                    {p.title}
                  </Link>
                ) : (
                  <a href={p.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium" style={{ color: "var(--lw-accent)" }}>
                    {p.title}
                  </a>
                )}
                {p.excerpt && <div className="text-[13px] text-neutral-500 mt-0.5">{p.excerpt}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.get("ACTIVITIES") && props.activities.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Activities & Memberships
          </h2>
          <ul className="flex flex-col gap-2.5">
            {props.activities.map((a) => (
              <li key={a.id} className="text-[14px]">
                <span className="font-medium">{a.title}</span>
                {a.year && <span className="text-neutral-500"> · {a.year}</span>}
                {a.description && <div className="text-[13px] text-neutral-600 mt-0.5">{renderMarkupToReact(a.description)}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.get("SOCIAL_CONTACT") && props.socialLinks.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-[15px] mb-3" style={{ fontFamily: "var(--lw-heading-font)", color: "var(--lw-primary)" }}>
            Connect
          </h2>
          <div className="flex flex-wrap gap-3">
            {props.socialLinks.map((l) => (
              <a key={l.platform + l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-[14px]" style={{ color: "var(--lw-accent)" }}>
                {l.platform}
              </a>
            ))}
          </div>
        </section>
      )}

      {visible.get("CV") && props.cvDownloadUrl && (
        <section className="mt-8">
          <a href={props.cvDownloadUrl} className="hover:underline text-[14px] font-medium" style={{ color: "var(--lw-accent)" }}>
            Download CV
          </a>
        </section>
      )}

      <LawyerSiteFooter displayName={props.displayName} />
    </div>
  );
}

/**
 * The only footer a visitor ever sees on a lawyer's published pages —
 * this is their site, not Lavelle's. No sitemap, no nav, no
 * institutional branding, just whose site this is and a light credit
 * line. Exported so the standalone article page (which doesn't render
 * through LawyerSiteView) gets the exact same markup, not a hand-copied
 * lookalike that could drift.
 */
export function LawyerSiteFooter({ displayName }: { displayName: string }) {
  return (
    <footer className="mt-14 pt-5 border-t border-neutral-200 flex items-center justify-between flex-wrap gap-2 text-[12px] text-neutral-500">
      <span>
        © {new Date().getFullYear()} {displayName}
      </span>
      <a href={SITE_URL} className="hover:underline">
        Built with ♥ by Lavelle
      </a>
    </footer>
  );
}
