import * as React from "react";
import { cn } from "@/lib/cn";

// The scroll container lives here, not at each call site, so every table
// in the app is protected the same way — a narrow viewport scrolls the
// table itself, never the whole page horizontally. Invisible on desktop,
// where the table already fits within its container.
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-neutral-100 aria-selected:bg-accent-100", className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-left text-[11px] tracking-[0.08em] uppercase text-neutral-600 font-semibold px-[var(--space-2)] py-[var(--space-3)] border-b border-divider",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-[var(--space-2)] py-[var(--space-3)] border-b border-dashed border-neutral-300",
        className
      )}
      {...props}
    />
  );
}
