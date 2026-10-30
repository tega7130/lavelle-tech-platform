/** Burger menu panel, in the exact order specified by the build brief. */
export const AZUBI_MENU_LINKS = [
  { label: "How it works", href: "/azubi#how" },
  { label: "Host a fellow", href: "/azubi/contact?as=host" },
  { label: "About", href: "/azubi/about" },
  { label: "Mission and vision", href: "/azubi/mission-and-vision" },
  { label: "Questions", href: "/azubi#faq" },
  { label: "Contact", href: "/azubi/contact" },
] as const;

/** Footer link row. "Cookie settings" is appended separately by AzubiFooter. */
export const AZUBI_FOOTER_LINKS = [
  { label: "How it works", href: "/azubi#how" },
  { label: "About", href: "/azubi/about" },
  { label: "Mission and vision", href: "/azubi/mission-and-vision" },
  { label: "Apply", href: "/azubi/apply" },
  { label: "Contact", href: "/azubi/contact" },
  { label: "Privacy notice", href: "/azubi/privacy" },
  { label: "Terms of use", href: "/azubi/terms" },
] as const;
