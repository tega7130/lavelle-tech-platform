"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { label: "Overview", href: "/admin/azubi" },
  { label: "Fellows", href: "/admin/azubi/applications" },
  { label: "Organizations", href: "/admin/azubi/organizations" },
  { label: "Supervisors", href: "/admin/azubi/supervisors" },
  { label: "Enquiries", href: "/admin/azubi/enquiries" },
  { label: "Activity log", href: "/admin/azubi/activity-log" },
  { label: "Analytics", href: "/admin/azubi/analytics" },
] as const;

export function AzubiAdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 flex-wrap border-b border-divider mb-[var(--space-4)]">
      {TABS.map((tab) => {
        const active = tab.href === "/admin/azubi" ? pathname === tab.href : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center px-3 py-2 text-[13px] font-medium no-underline border-b-2 -mb-px",
              active ? "border-accent text-accent" : "border-transparent text-neutral-600 hover:text-text"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
