"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import { CANDIDATE_NAV_ITEMS } from "@/lib/candidate-nav";
import {
  DashboardIcon,
  ProgrammeIcon,
  CatalogueIcon,
  DeadlinesIcon,
  AssessmentIcon,
  ExamsIcon,
  CredentialsIcon,
  AiIcon,
  ProfileIcon,
  SupportIcon,
  SignOutIcon,
  BellIcon,
  BackIcon,
} from "@/components/icons";

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
  children: React.ReactNode;
}

function useOnlineStatus() {
  const [online, setOnline] = React.useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  React.useEffect(() => {
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

export function CandidateShell({ candidate, enrolled, crumb, onSignOut, children }: CandidateShellProps) {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const items = CANDIDATE_NAV.filter((item) => enrolled || !item.gated);
  const active = items.find((item) => pathname?.startsWith(item.href));
  const resolvedCrumb = crumb ?? { section: "Candidate Portal", title: active?.label ?? "" };

  return (
    <div className="flex h-screen bg-bg text-text font-body">
      <aside className="w-[236px] flex-none flex flex-col border-r border-divider p-[var(--space-4)] px-[var(--space-3)]">
        <div className="flex items-center gap-[10px] px-[2px] pb-[var(--space-6)]">
          <div className="w-[34px] h-[34px] flex-none rounded-lg bg-accent-2 flex items-center justify-center font-heading font-bold text-[17px] text-accent">
            L
          </div>
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
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex-none w-[30px] h-[30px] rounded-md border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 hover:text-text cursor-pointer"
          >
            <SignOutIcon />
          </button>
        </div>
      </aside>

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
            <button
              aria-label="Notifications"
              className="relative w-[38px] h-[38px] rounded-md border border-neutral-300 bg-bg text-text flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
            >
              <BellIcon />
            </button>
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

export interface CoursePlayerShellProps {
  lecture: { title: string; moduleTitle: string; duration: string };
  progressLabel: string;
  progressPct: number;
  onBack: () => void;
  onAskFaculty?: () => void;
  children: React.ReactNode;
}

/**
 * Shell rule 2: the course player takes over the window — sidebar and header
 * chrome are replaced entirely by a dark lecture rail and a single Back
 * control, rather than being layered on top of the normal shell.
 */
export function CoursePlayerShell({
  lecture,
  progressLabel,
  progressPct,
  onBack,
  onAskFaculty,
  children,
}: CoursePlayerShellProps) {
  return (
    <div className="flex h-screen bg-bg text-text font-body">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex-none flex items-center justify-between gap-[var(--space-4)] px-[var(--space-5)] py-[var(--space-3)] border-b border-divider bg-bg">
          <div className="flex items-center gap-[var(--space-4)] min-w-0">
            <button
              onClick={onBack}
              aria-label="Back"
              title="Back"
              className="flex-none w-[38px] h-[38px] rounded-md border border-divider bg-neutral-100 text-neutral-700 flex items-center justify-center hover:bg-neutral-200 cursor-pointer"
            >
              <BackIcon />
            </button>
            <div className="min-w-0">
              <div className="font-heading font-semibold text-base overflow-hidden text-ellipsis whitespace-nowrap">
                {lecture.title}
              </div>
              <div className="text-[11.5px] text-neutral-600">
                {lecture.moduleTitle} &middot; {lecture.duration}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[var(--space-4)] flex-none">
            <div className="flex items-center gap-[9px]">
              <span className="text-[11.5px] text-neutral-600">{progressLabel}</span>
              <div className="w-[88px] h-[6px] rounded-full bg-neutral-200 overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            {onAskFaculty && (
              <button
                onClick={onAskFaculty}
                className="inline-flex items-center gap-[7px] h-9 px-3 rounded-md border border-neutral-300 bg-bg text-[12.5px] font-heading font-semibold cursor-pointer hover:bg-neutral-100"
              >
                Ask faculty
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
