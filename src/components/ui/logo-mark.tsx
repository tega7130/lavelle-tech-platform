import Image from "next/image";
import { cn } from "@/lib/cn";

/** The Lavelle Institute mark — replaces every hand-drawn "L" badge in the app. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/images/lavelle-logo.png"
      alt="Lavelle Institute"
      width={size}
      height={size}
      className={cn("flex-none", className)}
    />
  );
}
