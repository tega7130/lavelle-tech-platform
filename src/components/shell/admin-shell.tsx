"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNavIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { staffSignOut } from "@/app/actions/staff-auth";

export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
  /** Badge text (a count, e.g. marking-queue size). Omit for no badge. */
  badge?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Institution",
    items: [
      { key: "overview", label: "Overview", href: "/admin/overview" },
      { key: "programmes", label: "Programmes", href: "/admin/programmes" },
    ],
  },
  {
    label: "Assessment",
    items: [
      { key: "marking", label: "Marking queue", href: "/admin/marking", badge: "12" },
      { key: "exambuilder", label: "Exam builder", href: "/admin/exam-builder" },
    ],
  },
  {
    label: "People",
    items: [
      { key: "candidates", label: "Candidates", href: "/admin/candidates" },
      { key: "support", label: "Support desk", href: "/admin/support", badge: "5" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "finance", label: "Finance", href: "/admin/finance" },
      { key: "comms", label: "Announcements", href: "/admin/announcements" },
      { key: "certs", label: "Certificates", href: "/admin/certificates" },
    ],
  },
  {
    label: "Marketing",
    items: [{ key: "website", label: "Website", href: "/admin/website" }],
  },
  {
    label: "Administration",
    items: [
      { key: "staff", label: "Staff & permissions", href: "/admin/staff" },
      { key: "auditlog", label: "Audit log", href: "/admin/audit-log" },
    ],
  },
];

export interface AdminShellProps {
  staff: { name: string; initials: string; role: string };
  /** Overrides the breadcrumb derived from the active nav item's group/label. */
  crumb?: { section: string; title: string };
  headerTag?: string;
  children: React.ReactNode;
}

export function AdminShell({ staff, crumb, headerTag, children }: AdminShellProps) {
  const pathname = usePathname();
  const [railOpen, setRailOpen] = React.useState(true);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  async function confirmSignOut() {
    setSigningOut(true);
    await staffSignOut();
  }

  let resolvedCrumb = crumb;
  if (!resolvedCrumb) {
    for (const group of ADMIN_NAV) {
      const item = group.items.find((i) => pathname?.startsWith(i.href));
      if (item) {
        resolvedCrumb = { section: group.label, title: item.label };
        break;
      }
    }
    resolvedCrumb ??= { section: "", title: "" };
  }

  return (
    <div className="flex h-screen bg-bg text-text font-body">
      <aside
        className={cn(
          "flex-none flex flex-col border-r border-divider py-[var(--space-4)] px-[var(--space-3)] overflow-y-auto overflow-x-hidden transition-[width] duration-[220ms] ease-in-out",
          railOpen ? "w-[246px]" : "w-[66px]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-[10px] px-[2px] pb-[var(--space-6)]",
            !railOpen && "justify-center"
          )}
        >
          <div className="w-[34px] h-[34px] flex-none rounded-lg bg-accent-2 flex items-center justify-center font-heading font-bold text-[17px] text-accent">
            L
          </div>
          {railOpen && (
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-[17px] tracking-[-0.01em]">Lavelle</div>
              <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500">
                Administration
              </div>
            </div>
          )}
          {railOpen && (
            <button
              onClick={() => setRailOpen(false)}
              aria-label="Collapse navigation"
              title="Collapse navigation"
              className="flex-none w-[26px] h-[26px] rounded-[7px] border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
            >
              <ChevronLeftIcon />
            </button>
          )}
        </div>

        {!railOpen && (
          <button
            onClick={() => setRailOpen(true)}
            aria-label="Expand navigation"
            title="Expand navigation"
            className="w-[34px] h-[26px] mx-auto mb-[var(--space-4)] rounded-[7px] border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
          >
            <ChevronRightIcon />
          </button>
        )}

        <nav className="flex flex-col gap-[var(--space-4)] flex-1">
          {ADMIN_NAV.map((group) => (
            <div key={group.label} className="flex flex-col gap-[2px]">
              {railOpen ? (
                <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-500 px-[var(--space-3)] pb-1">
                  {group.label}
                </div>
              ) : (
                <div className="h-px bg-divider mx-2 my-1" />
              )}
              {group.items.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "relative flex items-center gap-[10px] px-[var(--space-3)] py-2 rounded-md text-[13.5px] no-underline",
                      railOpen ? "justify-start" : "justify-center",
                      active ? "text-accent bg-accent-100" : "text-text hover:bg-neutral-100"
                    )}
                  >
                    <AdminNavIcon name={item.key} />
                    {railOpen && (
                      <>
                        <span className="flex-1 min-w-0">{item.label}</span>
                        {item.badge && (
                          <span className="inline-flex items-center rounded-full text-[10px] font-medium px-[7px] py-[2px] bg-accent-100 text-accent-700">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {!railOpen && item.badge && (
                      <span className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-divider pt-[var(--space-3)] mt-[var(--space-4)] flex items-center gap-[10px]",
            !railOpen && "justify-center"
          )}
        >
          <div className="w-8 h-8 flex-none rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-xs font-heading font-semibold">
            {staff.initials}
          </div>
          {railOpen && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[13px]">{staff.name}</div>
                <div className="text-[11px] text-neutral-500">{staff.role}</div>
              </div>
              <button
                onClick={() => setSignOutOpen(true)}
                aria-label="Sign out"
                title="Sign out"
                className="flex-none w-7 h-7 rounded-md border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
              >
                <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 15.5H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 2.5h3" />
                  <path d="M12 12.5 15.5 9 12 5.5" />
                  <path d="M15.5 9H7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </aside>

      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out of the console?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSignOutOpen(false)}>
              Stay signed in
            </Button>
            <Button variant="primary" disabled={signingOut} onClick={confirmSignOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </>
        }
      >
        Any unsaved work in an open editor will be lost. You will need your staff email and password to sign in again.
      </Dialog>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex-none flex items-center justify-between gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-4)] border-b border-divider">
          <div>
            <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">
              {resolvedCrumb.section}
            </div>
            <h2 className="mt-[2px] mb-0">{resolvedCrumb.title}</h2>
          </div>
          <div className="flex items-center gap-[var(--space-3)]">
            {headerTag && (
              <span className="inline-flex items-center rounded-full text-[11px] font-medium px-[10px] py-[3px] border border-accent-300 text-accent-700 bg-bg">
                {headerTag}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">{children}</main>
      </div>
    </div>
  );
}
