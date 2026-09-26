import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentStaff } from "@/lib/staff-session";
import { getFeatureSummary, listSignups } from "@/lib/beta-gate";
import { BetaFeature } from "@/generated/prisma/client";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { ManualGrantForm } from "@/components/admin/beta-manual-grant-form";
import { MarkFeaturePublicButton } from "@/components/admin/beta-mark-public-button";

const FEATURE_LABEL: Record<BetaFeature, string> = {
  [BetaFeature.PROGRAMME]: "Course enrolment",
  [BetaFeature.DOCUMENT_LIBRARY]: "Document Library",
};

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  GRANTED: "success",
  WAITLISTED: "warning",
};

async function FeatureSection({ feature }: { feature: BetaFeature }) {
  const [summary, signups] = await Promise.all([getFeatureSummary(feature), listSignups(feature)]);

  return (
    <div className="mb-[var(--space-8)]">
      <div className="flex items-center justify-between mb-[var(--space-3)]">
        <div>
          <h2 className="font-heading text-lg">{FEATURE_LABEL[feature]}</h2>
          <div className="text-[13px] text-neutral-600">
            {summary.granted}/{summary.slots} granted · {summary.waitlisted} waitlisted
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ManualGrantForm feature={feature} />
          <MarkFeaturePublicButton feature={feature} label={FEATURE_LABEL[feature]} />
        </div>
      </div>

      {signups.length === 0 ? (
        <div className="text-center py-10 border border-divider rounded-md text-[13px] text-neutral-500">No signups yet</div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Candidate</Th>
                <Th>Status</Th>
                <Th>Source</Th>
                <Th>Signed up</Th>
                <Th className="pr-[var(--space-4)]">Feedback</Th>
              </Tr>
            </Thead>
            <Tbody>
              {signups.map((s) => (
                <Tr key={s.id}>
                  <Td className="pl-[var(--space-4)] font-medium">
                    <Link href={`/admin/candidates/${s.candidateId}`} className="text-accent no-underline">
                      {s.candidate.firstName} {s.candidate.lastName}
                    </Link>
                    <div className="text-[11px] text-neutral-500">{s.candidate.email}</div>
                  </Td>
                  <Td>
                    <Tag variant={STATUS_TAG[s.status] as TagVariant}>{s.status}</Tag>
                  </Td>
                  <Td className="text-[12px] text-neutral-600">{s.source ?? "—"}</Td>
                  <Td className="text-[12px] text-neutral-600">{s.createdAt.toLocaleDateString()}</Td>
                  <Td className="pr-[var(--space-4)] text-[12.5px] max-w-[320px]">
                    {s.feedback.length === 0 ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {s.feedback.map((f) => (
                          <div key={f.id}>
                            <span className="text-[10.5px] uppercase tracking-wide text-neutral-500">{f.kind}</span>
                            <div>{f.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default async function BetaAccessPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/staff/sign-in");
  // Deliberate exception to the presence-based permission convention
  // (src/lib/staff-auth.ts) — this page is temporary and removed
  // entirely when the beta ends, so it isn't worth a permanent Permission
  // enum value + seeded grants just for a one-week test.
  if (staff.role !== "SUPER_ADMIN") redirect("/admin");

  return (
    <div className="max-w-[1000px]">
      <h1 className="font-heading text-2xl mb-[var(--space-1)]">Beta access</h1>
      <p className="text-[13px] text-neutral-600 mb-[var(--space-6)]">
        Temporary capacity gate for the beta test — 10 slots per feature, plus manual grants.
      </p>
      <FeatureSection feature={BetaFeature.PROGRAMME} />
      <FeatureSection feature={BetaFeature.DOCUMENT_LIBRARY} />
    </div>
  );
}
