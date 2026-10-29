import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type AzubiButtonVariant = "primary" | "outline" | "white";

const BASE =
  "inline-flex items-center justify-center gap-3 min-h-[48px] rounded-[12px] pl-[22px] pr-[10px] py-[8px] font-azubi font-bold text-[17px] leading-[1.2] no-underline border-2 transition-colors cursor-pointer";

const VARIANTS: Record<AzubiButtonVariant, string> = {
  primary: "bg-azubi-green-900 border-azubi-green-900 text-white hover:bg-azubi-green-700 hover:border-azubi-green-700",
  outline: "bg-transparent border-azubi-green-900 text-azubi-green-900 hover:bg-azubi-green-900 hover:text-white",
  white: "bg-white border-white text-azubi-green-900 hover:bg-azubi-green-900 hover:border-azubi-green-900 hover:text-white",
};

const ARROW_VARIANTS: Record<AzubiButtonVariant, string> = {
  primary: "bg-azubi-apricot text-azubi-green-900 group-hover:bg-white group-hover:text-azubi-green-900",
  outline: "bg-azubi-green-900 text-white group-hover:bg-azubi-apricot group-hover:text-azubi-green-900",
  white: "bg-azubi-green-900 text-white group-hover:bg-azubi-apricot group-hover:text-azubi-green-900",
};

function Arrow({ variant }: { variant: AzubiButtonVariant }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid place-items-center w-[30px] h-[30px] rounded-[8px] text-[18px] flex-none transition-colors", ARROW_VARIANTS[variant])}
    >
      →
    </span>
  );
}

export function AzubiButton({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: AzubiButtonVariant;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], "group", className)} {...rest}>
      {children}
      <Arrow variant={variant} />
    </Link>
  );
}

export const AzubiSubmitButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: AzubiButtonVariant }>(
  ({ className, variant = "primary", type = "submit", children, ...rest }, ref) => (
    <button ref={ref} type={type} className={cn(BASE, VARIANTS[variant], "group", "disabled:opacity-50 disabled:cursor-not-allowed", className)} {...rest}>
      {children}
      <Arrow variant={variant} />
    </button>
  )
);
AzubiSubmitButton.displayName = "AzubiSubmitButton";
