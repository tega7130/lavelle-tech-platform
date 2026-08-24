import { notFound } from "next/navigation";
import {
  getCandidateOverview,
  getCandidateNotesAndRequests,
  getCandidateAuditEvents,
  getCandidateCertificatesForAdmin,
} from "@/lib/candidate-admin-reads";
import { listCandidateEnrolments, listCandidatePayments, candidateHasStalePendingPayment } from "@/lib/finance-reads";
import { listProgrammes } from "@/lib/programme-reads";
import { listCandidateMarks } from "@/lib/marking-reads";
import { getCandidateProgress } from "@/lib/progress-admin-reads";
import { getVideoWatchStatsForCandidate } from "@/lib/video-analytics";
import { getSignedAssetUrl } from "@/lib/storage";
import { requireStaffSession } from "@/lib/staff-auth";
import { Permission, ProgrammeStatus } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/lib/rbac";
import { CandidateOverviewTab } from "@/components/admin/candidate-tabs/overview-tab";
import { CandidateEnrolmentsTab } from "@/components/admin/candidate-tabs/enrolments-tab";
import { CandidatePaymentsTab } from "@/components/admin/candidate-tabs/payments-tab";
import { CandidateProgressTab } from "@/components/admin/candidate-tabs/progress-tab";
import { CandidateAssessmentsTab } from "@/components/admin/candidate-tabs/assessments-tab";
import { CandidateCertificatesTab } from "@/components/admin/candidate-tabs/certificates-tab";
import { CandidateNotesRequestsTab } from "@/components/admin/candidate-tabs/notes-requests-tab";
import { CandidateAuditLogTab } from "@/components/admin/candidate-tabs/audit-log-tab";

const VALID_TABS = ["overview", "enrolments", "payments", "progress", "assessments", "certificates", "notes", "audit"] as const;

export default async function CandidateRecordTabPage({ params }: { params: Promise<{ id: string; tab: string }> }) {
  const { id, tab } = await params;
  if (!(VALID_TABS as readonly string[]).includes(tab)) notFound();
  const user = await requireStaffSession();

  switch (tab) {
    case "overview": {
      const overview = await getCandidateOverview(id);
      if (!overview.candidate) notFound();
      return (
        <CandidateOverviewTab
          candidateId={id}
          applicantNumber={overview.candidate.applicantNumber}
          candidateNumber={overview.candidate.candidateNumber}
          email={overview.candidate.email}
          phoneCountryCode={overview.candidate.phoneCountryCode}
          firstName={overview.candidate.firstName}
          lastName={overview.candidate.lastName}
          phone={overview.candidate.phone}
          canEdit={user.permissions.includes(Permission.EDIT_CANDIDATE_DETAILS)}
          enrolmentCount={overview.enrolmentCount}
          paymentCount={overview.paymentCount}
          certificateCount={overview.certificateCount}
          openRequestCount={overview.openRequestCount}
        />
      );
    }

    case "enrolments": {
      const enrolments = await listCandidateEnrolments(id);
      return <CandidateEnrolmentsTab enrolments={enrolments} />;
    }

    case "payments": {
      if (!user.permissions.includes(Permission.VIEW_FINANCE)) notFound();
      const [payments, stalePending, activeProgrammes, candidate] = await Promise.all([
        listCandidatePayments(id),
        candidateHasStalePendingPayment(id),
        listProgrammes({ status: ProgrammeStatus.ACTIVE }),
        getCandidateOverview(id).then((o) => o.candidate),
      ]);
      if (!candidate) notFound();
      const paymentsWithReceipt = payments.map((p) => ({
        ...p,
        receiptUrl: p.receiptAsset ? getSignedAssetUrl(p.receiptAsset.storageKey) : null,
      }));
      return (
        <CandidatePaymentsTab
          candidateId={id}
          candidateName={`${candidate.firstName} ${candidate.lastName}`}
          hasCandidateNumber={!!candidate.candidateNumber}
          payments={paymentsWithReceipt}
          stalePending={stalePending}
          activeProgrammes={activeProgrammes.map((p) => ({ id: p.id, title: p.title, code: p.code }))}
        />
      );
    }

    case "progress": {
      const [progress, videoWatch] = await Promise.all([getCandidateProgress(id), getVideoWatchStatsForCandidate(id)]);
      return <CandidateProgressTab progress={progress} videoWatch={videoWatch} />;
    }

    case "assessments": {
      const marks = await listCandidateMarks(id);
      return <CandidateAssessmentsTab marks={marks} />;
    }

    case "certificates": {
      const certificates = await getCandidateCertificatesForAdmin(id);
      return <CandidateCertificatesTab certificates={certificates} />;
    }

    case "notes": {
      const { notes, requests } = await getCandidateNotesAndRequests(id);
      return <CandidateNotesRequestsTab candidateId={id} notes={notes} requests={requests} />;
    }

    case "audit": {
      let events: Awaited<ReturnType<typeof getCandidateAuditEvents>>;
      try {
        events = await getCandidateAuditEvents(id);
      } catch (err) {
        if (err instanceof PermissionDeniedError) notFound();
        throw err;
      }
      return <CandidateAuditLogTab events={events} />;
    }

    default:
      notFound();
  }
}
