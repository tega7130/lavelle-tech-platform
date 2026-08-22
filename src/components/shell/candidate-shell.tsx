"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { CANDIDATE_NAV_ITEMS } from "@/lib/candidate-nav";
import {
  listCandidateNotificationsAction,
  markCandidateNotificationReadAction,
  markAllCandidateNotificationsReadAction,
} from "@/app/actions/notifications";
import {
  DashboardIcon,
  ProgrammeIcon,
  CatalogueIcon,
  DeadlinesIcon,
  AssessmentIcon,
  NotesIcon,
  ExamsIcon,
  CredentialsIcon,
  AiIcon,
  ProfileIcon,
  SupportIcon,
  SignOutIcon,
  BellIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/ui/logo-mark";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface CandidateShellNavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGAttributes<SVGSVGElement>>;
  /** Hidden entirely (not disabled) for applicants who have not completed payment. */
  gated?: boolean;
}

const NAV_ICONS: Record<string, React.ComponentType<React.SVGAttributes<SVGSVGElement>>> = {
  dashboard: DashboardIcon,
  programme: ProgrammeIcon,
  catalogue: CatalogueIcon,
  deadlines: DeadlinesIcon,
  assessment: AssessmentIcon,
  notes: NotesIcon,
  exams: ExamsIcon,
  credentials: CredentialsIcon,
  ai: AiIcon,
  profile: ProfileIcon,
  support: SupportIcon,
};

export const CANDIDATE_NAV: CandidateShellNavItem[] = CANDIDATE_NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.key]!,
}));

export interface CandidateNotificationItem {
  id: string;
  title: string;
  body: string;
  unread: boolean;
  createdAt: Date;
  href: string;
}

export interface CandidateShellProps {
  candidate: {
    name: string;
    initials: string;
    id: string;
    cohort?: string;
  };
  /** True once first payment is confirmed — controls applicant nav gating (README shell rule 1). */
  enrolled: boolean;
  /** Overrides the breadcrumb derived from the active nav item. */
  crumb?: { section: string; title: string };
  onSignOut?: () => void;
  initialNotifications?: { unreadCount: number; items: CandidateNotificationItem[] };
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

function useOnlineStatus() {
  // Starts true to match the server-rendered default — reading
  // navigator.onLine here would run during the client's first render too
  // and mismatch whenever the browser's real value isn't true, causing a
  // hydration error. The real value is only read after mount, below.
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export function CandidateShell({
  candidate,
  enrolled,
  crumb,
  onSignOut,
  initialNotifications,
  children,
}: CandidateShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnlineStatus();
  const items = CANDIDATE_NAV.filter((item) => enrolled || !item.gated);
  const active = items.find((item) => pathname?.startsWith(item.href));
  const resolvedCrumb = crumb ?? { section: "Candidate Portal", title: active?.label ?? "" };

  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [inbox, setInbox] = React.useState(initialNotifications ?? { unreadCount: 0, items: [] });
  const inboxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!inboxOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (inboxRef.current && !inboxRef.current.contains(e.target as Node)) setInboxOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [inboxOpen]);

  async function toggleInbox() {
    const next = !inboxOpen;
    setInboxOpen(next);
    if (next) setInbox(await listCandidateNotificationsAction());
  }

  async function openNotification(n: CandidateNotificationItem) {
    setInboxOpen(false);
    if (n.unread) {
      await markCandidateNotificationReadAction(n.id);
      setInbox((cur) => ({
        unreadCount: Math.max(0, cur.unreadCount - 1),
        items: cur.items.map((i) => (i.id === n.id ? { ...i, unread: false } : i)),
      }));
    }
    router.push(n.href);
  }

  async function markAllRead() {
    await markAllCandidateNotificationsReadAction();
    setInbox((cur) => ({ unreadCount: 0, items: cur.items.map((i) => ({ ...i, unread: false })) }));
  }

  return (
    <div className="flex h-screen bg-bg text-text font-body">
      <aside className="w-[236px] flex-none flex flex-col border-r border-divider p-[var(--space-4)] px-[var(--space-3)]">
        <div className="flex items-center gap-[10px] px-[2px] pb-[var(--space-6)]">
          <LogoMark size={34} />
          <div>
            <div className="font-heading font-bold text-[17px] tracking-[-0.01em]">Lavelle</div>
            <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500">
              Candidate Portal
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-[2px] flex-1">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-[10px] px-[var(--space-3)] py-[9px] rounded-md text-sm no-underline",
                  active ? "text-accent bg-accent-100" : "text-text hover:bg-neutral-100"
                )}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-divider pt-[var(--space-3)] flex items-center gap-[10px]">
          <Link
            href="/portal/profile"
            className="flex-1 min-w-0 flex items-center gap-[10px] no-underline text-text"
          >
            <div className="w-8 h-8 flex-none rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-xs font-heading">
              {candidate.initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
                {candidate.name}
              </div>
              <div className="text-[11px] text-neutral-500">{candidate.id}</div>
            </div>
          </Link>
          <button
            onClick={() => setSignOutOpen(true)}
            aria-label="Sign out"
            title="Sign out"
            className="flex-none w-[30px] h-[30px] rounded-md border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 hover:text-text cursor-pointer"
          >
            <SignOutIcon />
          </button>
        </div>
      </aside>

      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onSignOut}>
              Sign out
            </Button>
          </>
        }
      >
        You will need to sign in again to access your dashboard, programmes and deadlines.
      </Dialog>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex-none flex items-center justify-between px-[var(--space-6)] py-[var(--space-4)] border-b border-divider">
          <div>
            <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">
              {resolvedCrumb.section}
            </div>
            <h2 className="mt-[2px] mb-0">{resolvedCrumb.title}</h2>
          </div>
          <div className="flex items-center gap-[var(--space-3)]">
            {candidate.cohort && (
              <span className="inline-flex items-center rounded-full text-[11px] font-medium px-[10px] py-[3px] border border-accent-300 text-accent-700 bg-bg">
                {candidate.cohort}
              </span>
            )}
            <div className="relative" ref={inboxRef}>
              <button
                onClick={toggleInbox}
                aria-label="Notifications"
                title="Notifications"
                className="relative w-[38px] h-[38px] rounded-md border border-neutral-300 bg-bg text-text flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
              >
                <BellIcon />
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
                        <div className="text-neutral-500 text-[11.5px] mt-[3px]">Announcements and updates arrive here.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </header>

        {!online && (
          <div className="flex-none flex items-center gap-3 px-[var(--space-6)] py-2.5 bg-[#fff7e6] border-b border-[#f0d9a8] text-[#8a6013] text-[12.5px]">
            <span className="font-semibold">You are offline.</span>
            <span>
              Your connection dropped. You can keep reading anything already open, but marks, submissions and new
              lectures will not load until you are back on a network.
            </span>
            <span className="ml-auto text-[11px] opacity-75">Reconnecting automatically</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">{children}</main>
      </div>
    </div>
  );
}
