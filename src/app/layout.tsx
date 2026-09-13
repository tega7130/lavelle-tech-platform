import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/site/cookie-consent-banner";
import { Analytics } from "@/components/site/analytics";
import { SITE_URL } from "@/lib/site-url";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lavelle Institute",
  description:
    "Professional legal specialization and CPD platform for the Nigerian legal market.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text font-body">
        <ThemeProvider>
          {children}
          <CookieConsentBanner />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
