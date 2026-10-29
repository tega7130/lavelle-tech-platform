import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Typeset placeholder for the Azubi wordmark — build brief section 1: no
 * logo file exists yet, so this renders the name/sublabel as text so a
 * real mark can swap in later without touching every call site.
 */
export function AzubiWordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link
      href="/azubi"
      className={cn("flex flex-col leading-none no-underline", light ? "text-white" : "text-azubi-green-900", className)}
    >
      <span className="font-azubi text-[28px] sm:text-[30px] font-extrabold tracking-[-0.03em]">Azubi</span>
      <span
        className={cn(
          "text-[10px] sm:text-[11px] tracking-[0.34em] uppercase font-bold mt-[4px] sm:mt-[5px]",
          light ? "text-azubi-sage" : "text-azubi-green-700"
        )}
      >
        Foundation
      </span>
    </Link>
  );
}
