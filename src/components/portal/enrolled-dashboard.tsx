import Link from "next/link";
import { Card, CardKicker, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { tierLabel } from "@/lib/format";
import type { CurrentCandidate } from "@/lib/candidate-session";
import type { getEnrolledSummary } from "@/lib/catalogue-reads";

type Summary = Awaited<ReturnType<typeof getEnrolledSummary>>;

export function EnrolledDashboard({ candidate, summary }: { candidate: CurrentCandidate; summary: Summary }) {
  const { enrolments, idCard } = summary;
  const primary = enrolments[0];

  return (
    <div className="max-w-[1000px] flex flex-col gap-[var(--space-6)]">
      <Card elev="sm" stripe="blue" className="p-[var(--space-6)]">
        <CardKicker>Welcome back</CardKicker>
        <div className="font-heading text-2xl mt-1">
          {candidate.firstName} {candidate.lastName}
        </div>
        <div className="text-neutral-600 text-[13px] mt-1">
          Candidate number <span className="font-medium text-text tabular-nums">{candidate.candidateNumber}</span>
        </div>
      </Card>

      <div className="grid grid-cols-[2fr_1fr] gap-[var(--space-6)]">
        <div className="flex flex-col gap-[var(--space-4)]">
          <h3 className="m-0">Your programmes</h3>
          {enrolments.map((e) => (
            <Card key={e.id} elev="sm">
              <div className="flex items-center gap-2">
                <Tag variant="accent">{tierLabel(e.programme.tier)}</Tag>
                <Tag variant={e.status === "COMPLETED" ? "outline" : "neutral"}>
                  {e.status === "COMPLETED" ? "Completed" : "Active"}
                </Tag>
              </div>
              <CardTitle className="mt-1.5">{e.programme.title}</CardTitle>
              <div className="text-[12px] text-neutral-500 mt-1">
                {e.cohort ? `Cohort ${e.cohort.code}` : "Cohort placement pending"} &middot; {e.intake.month} {e.intake.year} intake
              </div>
              <Link href="/portal/programme" className={buttonClassName("secondary", "mt-3 self-start text-xs px-3 py-1.5 h-auto")}>
                Open programme
              </Link>
            </Card>
          ))}
          {!primary && (
            <Card elev="sm" className="items-center text-center py-10">
              <div className="font-heading font-semibold text-[14px]">No active enrolment</div>
              <p className="text-neutral-600 text-[12px] mt-1">Your enrolment record could not be found.</p>
            </Card>
          )}
        </div>

        <Card elev="md" className="h-fit p-0 overflow-hidden">
          <div
            className="p-[var(--space-5)] text-white relative overflow-hidden"
            style={{ background: "linear-gradient(158deg, #0c356f, #08234a)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-[30px] h-[30px] rounded-md bg-accent-2 flex items-center justify-center font-heading font-bold text-[15px] text-accent-900">
                L
              </div>
              <div>
                <div className="font-heading font-bold text-[13px] tracking-[0.02em]">LAVELLE INSTITUTE</div>
                <div className="text-[8.5px] tracking-[0.14em] uppercase text-white/55">Candidate identification</div>
              </div>
            </div>
            <div className="mt-[var(--space-5)]">
              <div className="text-[8.5px] tracking-[0.1em] uppercase text-white/50">Name</div>
              <div className="font-heading font-semibold text-[15px] mt-0.5">
                {candidate.firstName} {candidate.lastName}
              </div>
              <div className="flex gap-[var(--space-5)] mt-2.5">
                <div>
                  <div className="text-[8.5px] tracking-[0.1em] uppercase text-white/50">Candidate no.</div>
                  <div className="text-xs mt-0.5 tabular-nums">{candidate.candidateNumber}</div>
                </div>
                {idCard && (
                  <div>
                    <div className="text-[8.5px] tracking-[0.1em] uppercase text-white/50">Tier</div>
                    <div className="text-xs mt-0.5">{tierLabel(idCard.tier)}</div>
                  </div>
                )}
              </div>
            </div>
            {idCard && (
              <div className="flex justify-between mt-[var(--space-5)] pt-[var(--space-4)] border-t border-dashed border-white/22 text-[11px] text-white/50">
                <span>Issued &middot; {new Date(idCard.issuedAt).toLocaleDateString("en-GB")}</span>
                <span>Valid to &middot; {new Date(idCard.validUntil).toLocaleDateString("en-GB")}</span>
              </div>
            )}
          </div>
          <div className="p-[var(--space-4)]">
            <Link href="/portal/profile" className={buttonClassName("secondary", "w-full justify-center")}>
              View full profile
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
