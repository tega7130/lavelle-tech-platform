import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getLawyerWebsiteForCandidate, getConnectableCertificates } from "@/lib/lawyer-website";
import { LawyerWebsiteBuilder } from "@/components/portal/lawyer-website-builder";

export default async function LawyerWebsitePage() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const [site, connectableCertificates] = await Promise.all([
    getLawyerWebsiteForCandidate(candidate.id),
    getConnectableCertificates(candidate.id),
  ]);

  return (
    <LawyerWebsiteBuilder
      site={
        site
          ? {
              id: site.id,
              entityType: site.entityType,
              firmName: site.firmName,
              handle: site.handle,
              handleAutoSuffixedAt: site.handleAutoSuffixedAt,
              templateKey: site.templateKey,
              colorThemeKey: site.colorThemeKey,
              fontPairingKey: site.fontPairingKey,
              introText: site.introText,
              biographyText: site.biographyText,
              personalStatementText: site.personalStatementText,
              careerJourneyText: site.careerJourneyText,
              personalInterestsText: site.personalInterestsText,
              conductDisclaimerAcknowledgedAt: site.conductDisclaimerAcknowledgedAt,
              verification: site.verification
                ? {
                    scnNumber: site.verification.scnNumber,
                    idCardEvidenceAssetId: site.verification.idCardEvidenceAssetId,
                    cacNumber: site.verification.cacNumber,
                    firmEvidenceAssetId: site.verification.firmEvidenceAssetId,
                    status: site.verification.status,
                    rejectionReason: site.verification.rejectionReason,
                  }
                : null,
              qualifications: site.qualifications.map((q) => ({ id: q.id, source: q.source, title: q.title, issuer: q.issuer, year: q.year })),
              experiences: site.experiences.map((e) => ({
                id: e.id,
                organisation: e.organisation,
                roleTitle: e.roleTitle,
                startYear: e.startYear,
                endYear: e.endYear,
                isCurrent: e.isCurrent,
                description: e.description,
              })),
              publications: site.publications.map((p) => ({
                id: p.id,
                kind: p.kind,
                title: p.title,
                externalUrl: p.externalUrl,
                excerpt: p.excerpt,
                body: p.body,
                slug: p.slug,
                isPublished: p.isPublished,
              })),
              activities: site.activities.map((a) => ({ id: a.id, title: a.title, description: a.description, year: a.year })),
              isPublished: site.isPublished,
              publishRequestedAt: site.publishRequestedAt,
              takenDownAt: site.takenDownAt,
              takenDownReason: site.takenDownReason,
            }
          : null
      }
      candidateHasScnOnFile={!!candidate.profile?.scnNumber}
      connectableCertificates={connectableCertificates}
    />
  );
}
