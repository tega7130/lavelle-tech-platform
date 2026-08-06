import * as React from "react";
import { cn } from "@/lib/cn";

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium text-neutral-700 mb-[6px]", className)}
      {...props}
    />
  );
}

const inputBase =
  "w-full box-border font-body text-sm text-text bg-bg border rounded-md px-3 outline-none transition-colors placeholder:text-neutral-500 hover:border-neutral-400 focus-visible:border-accent";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Candidate-flow inputs are 44px tall; dense admin tables use 38px. */
  dense?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, dense, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        inputBase,
        dense ? "h-[38px]" : "h-11",
        invalid ? "border-[#c0392b]" : "border-neutral-300",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        inputBase,
        "min-h-24 py-2 resize-y",
        invalid ? "border-[#c0392b]" : "border-neutral-300",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function FieldError({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  if (!children) return null;
  return (
    <div
      className={cn("flex items-center gap-[5px] mt-[6px] text-[11.5px] text-[#c0392b]", className)}
      {...props}
    >
      <span aria-hidden>⚠</span>
      <span>{children}</span>
    </div>
  );
}
