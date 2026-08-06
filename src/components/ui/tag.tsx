import * as React from "react";
import { cn } from "@/lib/cn";

export type TagVariant = "accent" | "accent-2" | "neutral" | "outline";

const variants: Record<TagVariant, string> = {
  accent: "bg-accent-100 text-accent-700",
  "accent-2": "bg-accent-2-200 text-accent-2-800",
  neutral: "bg-neutral-200 text-neutral-700",
  outline: "border border-accent-300 text-accent-700 bg-bg",
};

// Semantic status tags, kept outside the brand ramps per the token sheet.
const status = {
  success: "bg-[#e7f6ed] text-[#15803d] border border-[#bfe3cd]",
  warning: "bg-[#fff7e6] text-[#a16207] border border-[#f0d9a8]",
  danger: "bg-[#fdecec] text-[#b42318] border border-[#f3c4bf]",
} as const;

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant | keyof typeof status;
}

export function Tag({ className, variant = "neutral", ...props }: TagProps) {
  const cls = (variants as Record<string, string>)[variant] ?? status[variant as keyof typeof status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full text-[11px] font-medium tracking-[0.01em] px-[10px] py-[3px] whitespace-nowrap",
        cls,
        className
      )}
      {...props}
    />
  );
}
