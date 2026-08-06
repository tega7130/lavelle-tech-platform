import * as React from "react";
import { cn } from "@/lib/cn";

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn("w-[17px] h-[17px] flex-none accent-accent cursor-pointer", className)}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";
