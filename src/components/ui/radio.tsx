import * as React from "react";
import { cn } from "@/lib/cn";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
}

export function Radio({ className, label, ...props }: RadioProps) {
  return (
    <label className={cn("group inline-flex items-center gap-2 cursor-pointer text-sm", className)}>
      <input type="radio" className="peer sr-only" {...props} />
      <span
        className="w-4 h-4 flex-none rounded-full border-[1.5px] border-neutral-400 group-hover:border-accent peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-[inset_0_0_0_4px_var(--color-bg)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2"
        aria-hidden
      />
      <span>{label}</span>
    </label>
  );
}
