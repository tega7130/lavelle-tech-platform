import { Montserrat } from "next/font/google";
import { AzubiHeader } from "@/components/azubi/azubi-header";
import { AzubiFooter } from "@/components/azubi/azubi-footer";
import { AzubiCookieBanner } from "@/components/azubi/azubi-cookie-banner";
import { cn } from "@/lib/cn";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function AzubiLayout({ children }: LayoutProps<"/azubi">) {
  return (
    <div className={cn(montserrat.variable, "azubi-root flex flex-col min-h-screen bg-azubi-mist text-azubi-ink")}>
      <AzubiHeader />
      <main className="flex-1">{children}</main>
      <AzubiFooter />
      <AzubiCookieBanner />
    </div>
  );
}
