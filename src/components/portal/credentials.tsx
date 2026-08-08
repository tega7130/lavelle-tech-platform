import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { tierLabel } from "@/lib/format";
import type { getCandidateCredentials } from "@/lib/certificate-candidate-reads";

type Credentials = Awaited<ReturnType<typeof getCandidateCredentials>>;

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

export function Credentials({ data }: { data: Credentials }) {
  if (data.certificates.length === 0 && data.inProgress.length === 0) {
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

  return (
    <div className="max-w-[1120px] flex flex-col gap-[var(--space-6)]">
      <h1 className="font-heading text-2xl m-0">Credentials</h1>

      <div className="grid gap-[var(--space-4)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {data.certificates.map((c) => {
          const active = c.status === "ACTIVE";
          return (
            <Card key={c.id} elev="sm" className="p-0 gap-0 overflow-hidden">
              <div
                className="h-[4px]"
                style={{ background: active ? "var(--color-accent-2)" : c.status === "REVOKED" ? "#b42318" : "var(--color-neutral-400)" }}
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

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-dashed border-neutral-300">
                  <div>
                    <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Grade</div>
                    <div className="text-[12.5px] font-medium mt-0.5">{BAND_LABEL[c.band]}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Issued</div>
                    <div className="text-[12.5px] font-medium mt-0.5">{fmtDate(c.issuedAt)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[9px] tracking-[0.1em] uppercase">Credits</div>
                    <div className="text-[12.5px] font-medium mt-0.5">{c.credits ?? "—"}</div>
                  </div>
                </div>

                <Link href={`/portal/credentials/${c.certificateNumber}`} className={buttonClassName("primary", "w-full justify-center mt-4 h-10 text-[13px]")}>
                  View certificate
                </Link>
              </div>
            </Card>
          );
        })}

        {data.inProgress.map((p) => (
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

              <Link href="/portal/programme" className={buttonClassName("secondary", "w-full justify-center mt-4 h-10 text-[13px]")}>
                Continue programme
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {data.certificates.length > 0 && (
        <Card elev="sm" className="bg-accent-100 border-accent-200">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="font-heading font-bold text-2xl">{data.certificates.filter((c) => c.status !== "SUPERSEDED").length}</div>
              <div className="text-accent-800 text-[11px] tracking-[0.06em] uppercase mt-0.5">Credentials held</div>
            </div>
            <div>
              <div className="font-heading font-bold text-2xl">{data.totalCreditsEarned}</div>
              <div className="text-accent-800 text-[11px] tracking-[0.06em] uppercase mt-0.5">Practice credits earned</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
