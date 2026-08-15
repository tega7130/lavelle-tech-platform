"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/field";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          tabIndex={-1}
          className="absolute right-0 top-0 h-11 w-10 flex items-center justify-center text-neutral-500 hover:text-text"
        >
          {visible ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
