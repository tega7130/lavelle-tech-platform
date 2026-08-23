import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { CheckIcon, LockIcon } from "@/components/icons";
import { tierLabel } from "@/lib/format";
import type { getCredentialsPageData } from "@/lib/credentials-page-reads";

type PageData = Awaited<ReturnType<typeof getCredentialsPageData>>;

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };
const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "accent-2",
  REVOKED: "danger",
  SUPERSEDED: "neutral",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Awarded", REVOKED: "Revoked", SUPERSEDED: "Superseded" };

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Seal({ tone }: { tone: "gold" | "blue" }) {
  return (
    <div
      className="w-[42px] h-[42px] rounded-full flex-none flex items-center justify-center"
      style={{
        background: tone === "gold" ? "var(--color-accent-2-200)" : "var(--color-accent-100)",
        color: tone === "gold" ? "var(--color-accent-2-800)" : "var(--color-accent-700)",
      }}
    >
      <svg viewBox="0 0 20 20" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3 12 4.4l2.3-.3.6 2.2 1.6 1.7-1.2 1.9.2 2.3-2.2.6L11.7 17 10 15.9 7.6 17 6 14.5l-2.2-.6.2-2.3L2.8 9.7l1.6-1.7L5 5.8l2.3.3z" />
      </svg>
    </div>
  );
}

export function Credentials({ data }: { data: PageData }) {
  const { ladder, certificates, inProgress, milestones, milestonesEarned, standingHeadline, standingExplanation, nextCertificate, advancedPractitioner } = data;

  if (certificates.length === 0 && inProgress.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-16">
        <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 20 20" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3 12 4.4l2.3-.3.6 2.2 1.6 1.7-1.2 1.9.2 2.3-2.2.6L11.7 17 10 15.9 7.6 17 6 14.5l-2.2-.6.2-2.3L2.8 9.7l1.6-1.7L5 5.8l2.3.3z" />
          </svg>
        </div>
        <div className="font-heading font-semibold text-[16px]">No credentials yet</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[48ch] mx-auto">
          Certificates you earn are listed here with their grade band and a public verification link. Your first is issued on passing a certifying
          examination.
        </p>
        <Link href="/portal/exams" className={buttonClassName("primary", "mt-5")}>
          View examination windows
        </Link>
      </div>
    );
  }

  const showApPathwayCard = ladder.find((r) => r.tier === "ADVANCED_PRACTITIONER")?.status === "locked";
  // A revoked certificate is no longer a held credential — every "awarded"
  // count on this page means ACTIVE only, matching standingExplanation.
  const awardedCount = certificates.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="max-w-[1120px] flex flex-col gap-[var(--space-6)]">
      <h1 className="font-heading text-2xl m-0">Certificates &amp; milestones</h1>

      <Card elev="sm" className="bg-accent-100 border-accent-200 p-[var(--space-5)]">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-[260px]">
            <div className="text-[10px] tracking-[0.1em] uppercase text-accent-700 font-semibold">Your standing</div>
            <div className="font-heading font-bold text-2xl mt-1">{standingHeadline}</div>
            <p className="text-accent-800 text-[13px] leading-[1.6] mt-1.5 max-w-[56ch]">{standingExplanation}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="rounded-md bg-bg border border-accent-2-300 px-4 py-2.5 text-center min-w-[92px]">
              <div className="font-heading font-bold text-xl">{awardedCount}</div>
              <div className="text-neutral-500 text-[10px] tracking-[0.05em] uppercase mt-0.5">Certificates awarded</div>
            </div>
            <div className="rounded-md bg-bg border border-divider px-4 py-2.5 text-center min-w-[92px]">
              <div className="font-heading font-bold text-xl">{milestonesEarned}</div>
              <div className="text-neutral-500 text-[10px] tracking-[0.05em] uppercase mt-0.5">Milestones earned</div>
            </div>
          </div>
        </div>

        <div className="flex items-center mt-[var(--space-5)] pt-[var(--space-4)] border-t border-dashed border-accent-300">
          {ladder.map((rung, i) => (
            <React.Fragment key={rung.tier}>
              {i > 0 && <div className="flex-1 h-[2px] mx-2" style={{ background: rung.status !== "locked" ? "var(--color-accent)" : "var(--color-accent-300)" }} />}
              <div className="flex items-center gap-2 flex-none">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-none text-[11px] font-bold ${
                    rung.status === "completed"
                      ? "bg-accent text-white"
                      : rung.status === "in_progress"
                        ? "border-2 border-accent text-accent bg-bg"
                        : "border-2 border-accent-300 text-accent-700 bg-bg"
                  }`}
                >
                  {rung.status === "completed" ? <CheckIcon width={12} height={12} /> : i + 1}
                </span>
                <div className="whitespace-nowrap">
                  <div className="text-[13px] font-medium">{tierLabel(rung.tier)}</div>
                  <div className="text-accent-700 text-[10.5px]">
                    {rung.status === "completed" ? "Complete" : rung.status === "in_progress" ? "In progress" : "Locked"}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {nextCertificate && (
          <div className="mt-[var(--space-4)] pt-[var(--space-4)] border-t border-dashed border-accent-300">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-heading font-semibold text-[13.5px]">
                Next certificate &mdash; {nextCertificate.programmeTitle} ({tierLabel(nextCertificate.tier)})
              </div>
              <div className="text-accent-800 text-[12px] tabular-nums">
                {nextCertificate.percent}%
              </div>
            </div>
            <div className="mt-2 h-[6px] rounded-full bg-bg overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${nextCertificate.percent}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
              <p className="text-accent-800 text-[12px] m-0">Complete your remaining lectures to prepare for the certifying examination.</p>
              <Link href="/portal/catalogue" className={buttonClassName("primary", "flex-none")}>
                Browse programmes
              </Link>
            </div>
          </div>
        )}
      </Card>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="m-0">Your certificates</h3>
          <div className="text-neutral-500 text-[12px]">
            {awardedCount} awarded &middot; {inProgress.length} in progress
          </div>
        </div>
        <div className="grid gap-[var(--space-4)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {certificates.map((c) => (
            <Card key={c.id} elev="sm" className="p-0 gap-0 overflow-hidden">
              <div
                className="h-[4px]"
                style={{ background: c.status === "ACTIVE" ? "var(--color-accent-2)" : c.status === "REVOKED" ? "#b42318" : "var(--color-neutral-400)" }}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Seal tone="gold" />
                  <Tag variant="accent">{tierLabel(c.tier)}</Tag>
                </div>
                <div className="font-heading font-semibold text-[15px] leading-snug mt-3">{c.programmeTitle}</div>
                <div className="mt-2">
                  <Tag variant={STATUS_TAG[c.status]}>{STATUS_LABEL[c.status]}</Tag>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-dashed border-neutral-300">
                  <div>
                    <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Grade</div>
                    <div className="text-[12.5px] font-medium mt-0.5">{BAND_LABEL[c.band]}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Issued</div>
                    <div className="text-[12.5px] font-medium mt-0.5">{fmtDate(c.issuedAt)}</div>
                  </div>
                </div>

                <Link href={`/portal/credentials/${c.certificateNumber}`} className={buttonClassName("primary", "w-full justify-center mt-4 h-10 text-[13px]")}>
                  View certificate
                </Link>
              </div>
            </Card>
          ))}

          {inProgress.map((p) => (
            <Card key={p.enrolmentId} elev="sm" className="p-0 gap-0 overflow-hidden">
              <div className="h-[4px]" style={{ background: "var(--color-accent)" }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Seal tone="blue" />
                  <Tag variant="accent">{tierLabel(p.tier)}</Tag>
                </div>
                <div className="font-heading font-semibold text-[15px] leading-snug mt-3">{p.programmeTitle}</div>
                <div className="mt-2">
                  <Tag variant="outline">In progress</Tag>
                </div>

                <div className="mt-4 pt-4 border-t border-dashed border-neutral-300">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5">
                    <span>Course progress</span>
                    <span className="tabular-nums">{p.percent}%</span>
                  </div>
                  <div className="h-[6px] rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${p.percent}%` }} />
                  </div>
                </div>

                <Link
                  href={`/portal/programme?programme=${p.programmeCode}`}
                  className={buttonClassName("secondary", "w-full justify-center mt-4 h-10 text-[13px]")}
                >
                  Continue programme
                </Link>
              </div>
            </Card>
          ))}

          {showApPathwayCard && (
            <Card elev="sm" className="p-5 border-dashed">
              <div className="flex items-start justify-between gap-3">
                <span className="w-[42px] h-[42px] rounded-md bg-neutral-100 text-neutral-400 flex-none flex items-center justify-center">
                  <LockIcon width={17} height={17} />
                </span>
                <Tag variant="neutral">Not started</Tag>
              </div>
              <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase mt-3">Advanced Practitioner</div>
              <div className="font-heading font-semibold text-[15px] leading-snug mt-1">Advanced Practitioner pathway</div>
              <p className="text-neutral-600 text-[12.5px] leading-[1.5] mt-2">
                Requires two Specialist certificates at Merit or above.{" "}
                {advancedPractitioner.remaining > 0
                  ? `You need ${advancedPractitioner.remaining} more.`
                  : "You have satisfied this requirement."}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-dashed border-neutral-300">
                <div>
                  <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Qualifying certificates</div>
                  <div className="text-[12.5px] font-medium mt-0.5 tabular-nums">{advancedPractitioner.held} of 2</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Opens</div>
                  <div className="text-[12.5px] font-medium mt-0.5">After 2 Specialist certificates</div>
                </div>
              </div>
              <Link href="/portal/catalogue" className={buttonClassName("secondary", "w-full justify-center mt-4 h-10 text-[13px]")}>
                See requirements
              </Link>
            </Card>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="m-0">Milestones</h3>
          <div className="text-neutral-500 text-[12px]">{milestonesEarned} of {milestones.length} earned</div>
        </div>
        <div className="grid gap-[var(--space-3)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {milestones.map((m) => (
            <Card
              key={m.key}
              elev="sm"
              className={m.earned ? "bg-accent-2-100 border-accent-2-300" : ""}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-6 h-6 rounded-full flex-none flex items-center justify-center ${
                    m.earned ? "bg-accent-2 text-accent-900" : "border-[1.5px] border-neutral-300 text-neutral-400"
                  }`}
                >
                  {m.earned ? <CheckIcon width={12} height={12} /> : null}
                </span>
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-[13px]">{m.title}</div>
                  <p className="text-neutral-600 text-[11.5px] leading-[1.5] mt-1">{m.description}</p>
                </div>
              </div>
              {!m.earned && m.progress != null && m.progress > 0 && (
                <div className="mt-2.5 h-[5px] rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${m.progress * 100}%` }} />
                </div>
              )}
            </Card>
          ))}
        </div>
        <p className="text-neutral-500 text-[11px] mt-3">
          Milestones are recorded on your candidate record and travel with your Lavelle practice record. They do not affect grades.
        </p>
      </div>
    </div>
  );
}
