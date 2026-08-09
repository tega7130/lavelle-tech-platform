import { notFound } from "next/navigation";
import { getCandidateForAdmin } from "@/lib/candidate-admin-reads";
import { requireStaffSession } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { CandidateRecordHeader } from "@/components/admin/candidate-record-header";

export default async function CandidateRecordLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [candidate, user] = await Promise.all([getCandidateForAdmin(id), requireStaffSession()]);
  if (!candidate) notFound();

  return (
    <div className="max-w-[1000px]">
      <CandidateRecordHeader
        candidateId={candidate.id}
        name={`${candidate.firstName} ${candidate.lastName}`}
        applicantNumber={candidate.applicantNumber}
        candidateNumber={candidate.candidateNumber}
        email={candidate.email}
        isSuspended={candidate.accountStatus === "SUSPENDED"}
        suspendedReason={candidate.suspendedReason}
        canViewPayments={user.permissions.includes(Permission.VIEW_FINANCE)}
      />
      {children}
    </div>
  );
}
