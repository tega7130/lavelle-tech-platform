import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { CheckIcon, LockIcon } from "@/components/icons";
import { tierLabel } from "@/lib/format";
import type { CurrentCandidate } from "@/lib/candidate-session";
import type { getDashboardSummary } from "@/lib/dashboard-reads";
import type { getCandidateCohortStatus } from "@/lib/profile-reads";
import { ProfileCompletionPrompt } from "@/components/portal/profile-completion-prompt";

type Summary = Awaited<ReturnType<typeof getDashboardSummary>>;
type CohortStatus = Awaited<ReturnType<typeof getCandidateCohortStatus>>;

const NUDGES = [
  (name: string) => `You are not studying for a certificate, ${name}. You are studying for the matter you have not been given yet.`,
  (name: string) => `Every module you finish now, ${name}, is a client you haven't met yet already better served.`,
  (name: string) => `The standard doesn't lower for a busy week, ${name} — but consistency beats intensity every time.`,
  (name: string) => `${name}, the credential is the record. The practice you're building is the point.`,
];

function pickNudge(candidateId: string, firstName: string) {
  let hash = 0;
  for (let i = 0; i < candidateId.length; i++) hash = (hash * 31 + candidateId.charCodeAt(i)) | 0;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const index = Math.abs(hash + dayIndex) % NUDGES.length;
  return NUDGES[index]!(firstName);
}

const LADDER_LABEL: Record<Summary["ladder"][number]["status"], string> = {
  completed: "Completed",
  in_progress: "In progress — current",
  locked: "Locked",
};

export function EnrolledDashboard({
  candidate,
  summary,
  cohortStatus,
}: {
  candidate: CurrentCandidate;
  summary: Summary;
  cohortStatus: CohortStatus;
}) {
  const { primaryProgramme, ladder, latestCertificate, deadlines, upcomingExam } = summary;

  return (
    <div className="max-w-[1120px] flex flex-col gap-[var(--space-5)]">
      <div className="rounded-md border border-divider bg-accent-100 px-[var(--space-5)] py-[var(--space-4)] flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-bg border border-divider flex items-center justify-center text-[13px] text-accent font-heading font-bold">
          &ldquo;
        </span>
        <div>
          <p className="text-[13.5px] leading-[1.6] m-0">{pickNudge(candidate.id, candidate.firstName)}</p>
          <div className="text-[11px] text-neutral-500 mt-1">On purpose &middot; Lavelle Institute</div>
        </div>
      </div>

      <ProfileCompletionPrompt candidate={candidate} />

      {upcomingExam && (
        <Card elev="md" stripe="blue" className="p-[var(--space-5)]">
          <div className="flex items-center gap-[var(--space-5)] flex-wrap">
            <div className="flex-none text-center px-1">
              <div className="font-heading font-bold text-[34px] leading-none text-accent tabular-nums">
                {upcomingExam.daysToGo}
              </div>
              <div className="text-[10px] tracking-[0.1em] uppercase text-neutral-500 mt-1 whitespace-nowrap">Days to go</div>
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">
                Certifying examination &middot; Registered
              </div>
              <div className="font-heading font-semibold text-[16px] mt-1">{upcomingExam.programmeTitle}</div>
              <div className="text-neutral-600 text-[12.5px] mt-1">
                {upcomingExam.opensAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                {" · "}
                {upcomingExam.opensAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                {" – "}
                {new Date(upcomingExam.opensAt.getTime() + upcomingExam.durationMinutes * 60_000).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })}
                {" WAT · "}
                {Math.round(upcomingExam.durationMinutes / 60)} hours &middot; proctored, remote
              </div>
            </div>
            <div className="flex gap-2 flex-none">
              <Link href={`/portal/exams/${upcomingExam.programmeCode}`} className={buttonClassName("secondary")}>
                Registration
              </Link>
              <Link href={`/portal/programme?programme=${upcomingExam.programmeCode}`} className={buttonClassName("primary")}>
                Prepare
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-[2fr_1fr] gap-[var(--space-5)] items-start max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-[var(--space-5)]">
          <Card elev="sm" className="p-[var(--space-6)]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardKicker>Welcome back</CardKicker>
                <div className="font-heading text-2xl mt-1">
                  {candidate.firstName} {candidate.lastName}
                </div>
                <div className="text-neutral-600 text-[13px] mt-1">
                  {candidate.candidateNumber} &middot; {cohortStatus?.statusLine ?? "No active cohort"}
                </div>
              </div>
              {primaryProgramme && (
                <Link href={`/portal/programme?programme=${primaryProgramme.programmeCode}`} className={buttonClassName("primary")}>
                  Continue learning
                </Link>
              )}
            </div>

            {primaryProgramme && (
              <div className="mt-[var(--space-5)] pt-[var(--space-4)] border-t border-dashed border-neutral-300">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[13.5px]">{primaryProgramme.programmeTitle}</div>
                  <div className="text-neutral-500 text-[12px] tabular-nums">
                    {primaryProgramme.completedLectures} / {primaryProgramme.totalLectures} lectures
                  </div>
                </div>
                <div className="mt-2 h-[7px] rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${primaryProgramme.percent}%` }} />
                </div>
                {primaryProgramme.upNext && (
                  <div className="text-neutral-500 text-[12px] mt-2">
                    Next: {primaryProgramme.upNext.moduleTitle} &middot; {primaryProgramme.upNext.lectureTitle}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div>
            <h3 className="m-0 mb-3">Upcoming deadlines</h3>
            {deadlines.filter((d) => d.kind !== "LECTURE_RELEASE").length === 0 ? (
              <Card elev="sm" className="text-center py-8">
                <div className="text-[13px] text-neutral-600">Nothing is due right now.</div>
              </Card>
            ) : (
              <div className="border border-divider rounded-md overflow-hidden">
                {deadlines
                  .filter((d) => d.kind !== "LECTURE_RELEASE")
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-[var(--space-4)] py-[var(--space-3)] border-b border-dashed border-neutral-300 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px]">{d.title}</div>
                        <div className="text-neutral-500 text-[11.5px] mt-0.5">
                          Due {d.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
                        </div>
                      </div>
                      <Tag variant={d.state === "OVERDUE" ? "danger" : d.state === "DUE_SOON" ? "warning" : "neutral"}>
                        {d.state === "DUE_SOON" ? "Due soon" : d.state === "OVERDUE" ? "Overdue" : "Upcoming"}
                      </Tag>
                    </div>
                  ))}
              </div>
            )}
            <Link href="/portal/deadlines" className="text-xs font-medium text-accent inline-block mt-2">
              View all deadlines →
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-[var(--space-5)]">
          <Card elev="sm">
            <CardKicker>Credentialing ladder</CardKicker>
            <div className="flex flex-col gap-3 mt-3">
              {ladder.map((rung) => (
                <div key={rung.tier} className="flex items-center gap-2.5">
                  <span
                    className={`flex-none w-6 h-6 rounded-full flex items-center justify-center ${
                      rung.status === "completed"
                        ? "bg-accent text-white"
                        : rung.status === "in_progress"
                          ? "border-[1.5px] border-accent text-accent"
                          : "border-[1.5px] border-neutral-300 text-neutral-400"
                    }`}
                  >
                    {rung.status === "completed" ? (
                      <CheckIcon width={12} height={12} />
                    ) : rung.status === "locked" ? (
                      <LockIcon width={11} height={11} />
                    ) : null}
                  </span>
                  <div>
                    <div className="text-[13px] font-medium">{tierLabel(rung.tier)}</div>
                    <div className="text-neutral-500 text-[11px]">{LADDER_LABEL[rung.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {latestCertificate && (
            <Card elev="sm">
              <CardKicker>Credentials</CardKicker>
              <div className="font-heading font-semibold text-[14px] mt-1.5">{latestCertificate.programmeTitle}</div>
              <p className="text-neutral-600 text-[12px] leading-[1.5] mt-1.5">
                Issued on completion of the {tierLabel(latestCertificate.tier)} tier. Verifiable via the public portal.
              </p>
              <Link
                href={`/portal/credentials/${latestCertificate.certificateNumber}`}
                className={buttonClassName("secondary", "w-full justify-center mt-2")}
              >
                View certificate
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
