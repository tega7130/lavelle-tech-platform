/** Burger menu panel, in the exact order specified by the build brief. */
export const AZUBI_MENU_LINKS = [
  { label: "How it works", href: "/azubi#how" },
  { label: "Host a fellow", href: "/azubi/contact?as=host" },
  { label: "About", href: "/azubi/about" },
  { label: "Mission and vision", href: "/azubi/mission-and-vision" },
  { label: "Questions", href: "/azubi#faq" },
  { label: "Contact", href: "/azubi/contact" },
] as const;

/**
 * Footer link columns, grouped and headed like Lavelle's own SiteFooter
 * (src/components/site/site-footer.tsx). "Cookie settings" is appended
 * separately by AzubiFooter.
 */
export const AZUBI_FOOTER_COLS = [
  {
    heading: "Foundation",
    links: [
      { label: "How it works", href: "/azubi#how" },
      { label: "About", href: "/azubi/about" },
      { label: "Mission and vision", href: "/azubi/mission-and-vision" },
    ],
  },
  {
    heading: "Get involved",
    links: [
      { label: "Apply", href: "/azubi/apply" },
      { label: "Contact", href: "/azubi/contact" },
    ],
  },
] as const;

/**
 * Privacy/Terms are hidden from the footer for now (not deleted — the
 * pages at /azubi/privacy and /azubi/terms are untouched). Kept here,
 * unreferenced, so they can be dropped back into AZUBI_FOOTER_COLS (or
 * their own column) later with no rebuilding.
 */
export const AZUBI_FOOTER_LEGAL_LINKS_HIDDEN = [
  { label: "Privacy notice", href: "/azubi/privacy" },
  { label: "Terms of use", href: "/azubi/terms" },
] as const;
