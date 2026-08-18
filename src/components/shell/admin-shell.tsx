"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNavIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { staffSignOut } from "@/app/actions/staff-auth";
import { listStaffNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions/notifications";

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
      { key: "invigilation", label: "Invigilation", href: "/admin/invigilation" },
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
    items: [
      { key: "website", label: "Website", href: "/admin/website" },
      { key: "reviews", label: "Reviews", href: "/admin/reviews" },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "staff", label: "Staff & permissions", href: "/admin/staff" },
      { key: "auditlog", label: "Audit log", href: "/admin/audit-log" },
    ],
  },
];

export interface StaffNotificationItem {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  createdAt: Date;
  href: string;
}

export interface AdminShellProps {
  staff: { name: string; initials: string; role: string };
  /** Overrides the breadcrumb derived from the active nav item's group/label. */
  crumb?: { section: string; title: string };
  headerTag?: string;
  initialNotifications?: { unreadCount: number; items: StaffNotificationItem[] };
  children: React.ReactNode;
}

function relativeTime(d: Date) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminShell({ staff, crumb, headerTag, initialNotifications, children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [railOpen, setRailOpen] = React.useState(true);
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [inbox, setInbox] = React.useState(initialNotifications ?? { unreadCount: 0, items: [] });
  const inboxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!inboxOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (inboxRef.current && !inboxRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [inboxOpen]);

  async function confirmSignOut() {
    setSigningOut(true);
    await staffSignOut();
  }

  async function toggleInbox() {
    const next = !inboxOpen;
    setInboxOpen(next);
    if (next) setInbox(await listStaffNotificationsAction());
  }

  async function openNotification(n: StaffNotificationItem) {
    setInboxOpen(false);
    if (n.unread) {
      await markNotificationReadAction(n.id);
      setInbox((cur) => ({
        unreadCount: Math.max(0, cur.unreadCount - 1),
        items: cur.items.map((i) => (i.id === n.id ? { ...i, unread: false } : i)),
      }));
    }
    router.push(n.href);
  }

  async function markAllRead() {
    await markAllNotificationsReadAction();
    setInbox((cur) => ({ unreadCount: 0, items: cur.items.map((i) => ({ ...i, unread: false })) }));
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
          <LogoMark size={34} />
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
            <div className="relative" ref={inboxRef}>
              <button
                onClick={toggleInbox}
                aria-label="Notifications"
                title="Notifications"
                className="relative flex items-center justify-center h-9 px-[11px] rounded-md border border-neutral-300 bg-bg text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                <svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2.6a4.4 4.4 0 0 0-4.4 4.4c0 3.4-1.3 4.6-1.3 4.6h11.4s-1.3-1.2-1.3-4.6A4.4 4.4 0 0 0 9 2.6ZM7.4 14.2a1.7 1.7 0 0 0 3.2 0" />
                </svg>
                {inbox.unreadCount > 0 && (
                  <span className="absolute top-[3px] right-[4px] min-w-[15px] h-[15px] px-1 box-border rounded-full bg-accent text-white text-[9.5px] font-bold flex items-center justify-center tabular-nums">
                    {inbox.unreadCount}
                  </span>
                )}
              </button>
              {inboxOpen && (
                <div className="absolute top-[calc(100%+8px)] right-0 z-[60] w-[390px] max-h-[440px] overflow-y-auto rounded-md bg-bg border border-divider shadow-lg">
                  <div className="flex justify-between items-center gap-3 px-4 pt-4 pb-3 border-b border-dashed border-neutral-300 sticky top-0 bg-bg">
                    <div className="font-heading font-semibold text-[13.5px]">Your notifications</div>
                    <button onClick={markAllRead} className="text-[11.5px] font-medium text-accent hover:underline cursor-pointer">
                      Mark all read
                    </button>
                  </div>
                  <div className="flex flex-col">
                    {inbox.items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openNotification(n)}
                        className={`flex gap-[11px] px-4 py-3 text-left border-b border-dashed border-neutral-300 cursor-pointer hover:bg-neutral-100 ${n.unread ? "bg-accent-100" : ""}`}
                      >
                        <span className={`flex-none w-[7px] h-[7px] mt-1.5 rounded-full ${n.unread ? "bg-accent" : "bg-neutral-300"}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-[12.5px] leading-snug ${n.unread ? "font-semibold" : "font-normal"}`}>{n.title}</div>
                          <div className="text-neutral-500 text-[11.5px] leading-snug mt-0.5">{n.body}</div>
                          <div className="text-neutral-500 text-[10.5px] mt-1">{relativeTime(n.createdAt)}</div>
                        </div>
                      </button>
                    ))}
                    {inbox.items.length === 0 && (
                      <div className="px-4 py-6 text-center">
                        <div className="font-heading font-semibold text-[13px]">Nothing waiting</div>
                        <div className="text-neutral-500 text-[11.5px] mt-[3px]">Assignments and escalations arrive here.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">{children}</main>
      </div>
    </div>
  );
}
