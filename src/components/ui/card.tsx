import * as React from "react";
import { cn } from "@/lib/cn";

export type CardElevation = "sm" | "md" | "lg";

const elevation: Record<CardElevation, string> = {
  sm: "shadow-none",
  md: "shadow-md",
  lg: "shadow-lg",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elev?: CardElevation;
  /** Feature cards add a 3px top stripe to signal tier/state. */
  stripe?: "gold" | "blue" | "neutral";
}

const stripeCls: Record<NonNullable<CardProps["stripe"]>, string> = {
  gold: "before:bg-gradient-to-r before:from-accent-2-400 before:to-accent-2-600",
  blue: "before:bg-gradient-to-r before:from-accent-400 before:to-accent-600",
  neutral: "before:bg-neutral-200",
};

export function Card({ className, elev = "sm", stripe, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--space-2)] p-[var(--space-4)] rounded-md bg-bg border border-divider",
        elevation[elev],
        stripe && "relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px]",
        stripe && stripeCls[stripe],
        className
      )}
      {...props}
    />
  );
}

export function CardKicker({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-[10px] tracking-[0.1em] uppercase text-accent font-semibold", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("font-heading font-semibold text-base leading-tight", className)} {...props} />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("m-0 text-[13px] text-neutral-700 flex-1", className)} {...props} />;
}

export function CardMeta({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] text-neutral-500", className)} {...props} />
  );
}
