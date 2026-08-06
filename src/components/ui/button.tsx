import * as React from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-heading font-semibold text-sm leading-tight rounded-md border border-transparent px-[var(--space-4)] py-[9px] transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  // The gold-on-blue primary is the single most identifying brand element —
  // never render a primary action as blue-on-blue or blue text.
  primary:
    "bg-accent border-accent text-accent-2 hover:bg-accent-600 hover:border-accent-600 active:bg-accent-700 active:border-accent-700",
  secondary:
    "bg-bg border-neutral-300 text-text hover:bg-neutral-100 active:bg-neutral-200",
  ghost: "text-accent px-[var(--space-2)] hover:bg-accent-100 active:bg-accent-200",
  danger: "bg-[#b42318] border-[#b42318] text-white hover:bg-[#912019] hover:border-[#912019]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: boolean;
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", icon, block, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          variants[variant],
          icon && "w-[38px] h-[38px] px-0",
          block && "w-full mt-[var(--space-3)]",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
