import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-session";
import { getFeatureSummary, listSignups } from "@/lib/beta-gate";
import { BETA_FEATURE, type BetaFeature } from "@/lib/beta-types";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { ManualGrantForm } from "@/components/admin/beta-manual-grant-form";
import { MarkFeaturePublicButton } from "@/components/admin/beta-mark-public-button";
import { BetaFeatureSectionClient } from "@/components/admin/beta-feature-section-client";

const FEATURE_LABEL: Record<BetaFeature, string> = {
  PROGRAMME: "Course enrolment",
  DOCUMENT_LIBRARY: "Document Library",
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
        <BetaFeatureSectionClient signups={signups} />
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
      <FeatureSection feature={BETA_FEATURE.PROGRAMME} />
      <FeatureSection feature={BETA_FEATURE.DOCUMENT_LIBRARY} />
    </div>
  );
}
