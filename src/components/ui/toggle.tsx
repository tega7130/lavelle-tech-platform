import * as React from "react";
import { cn } from "@/lib/cn";

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** super_admin's toggle renders larger and red-when-on to signal its weight. */
  variant?: "default" | "danger";
}

// 38x22 track / 16px knob by default; danger (super_admin) variant is 46x26 / 20px.
export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, variant = "default", checked, ...props }, ref) => {
    const danger = variant === "danger";
    return (
      <label
        className={cn(
          "relative inline-flex flex-none cursor-pointer rounded-full transition-colors",
          danger ? "w-[46px] h-[26px]" : "w-[38px] h-[22px]",
          checked ? (danger ? "bg-[#b42318]" : "bg-accent") : "bg-neutral-200",
          className
        )}
      >
        <input ref={ref} type="checkbox" checked={checked} className="sr-only peer" {...props} />
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-[left] duration-[180ms] ease-in-out shadow-sm",
            danger ? "w-5 h-5" : "w-4 h-4",
            checked ? (danger ? "left-[24px]" : "left-[18px]") : "left-[2px]"
          )}
        />
        <span className="absolute inset-0 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2" />
      </label>
    );
  }
);
Toggle.displayName = "Toggle";
