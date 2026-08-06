import * as React from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
}

export interface SegmentedProps {
  name: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Segmented({ name, options, value, onChange, className }: SegmentedProps) {
  return (
    <div className={cn("inline-flex overflow-hidden bg-bg border border-neutral-300 rounded-md", className)}>
      {options.map((opt, i) => (
        <label
          key={opt.value}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium cursor-pointer has-[:checked]:text-accent has-[:checked]:bg-accent-100 not-has-[:checked]:hover:bg-neutral-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:-outline-offset-2",
            i > 0 && "border-l border-neutral-300"
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
