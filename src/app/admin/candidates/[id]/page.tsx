import { notFound } from "next/navigation";
import { getCandidateForAdmin } from "@/lib/candidate-admin-reads";
import { listCandidateEnrolments, listCandidatePayments, candidateHasStalePendingPayment } from "@/lib/finance-reads";
import { listProgrammes } from "@/lib/programme-reads";
import { listCandidateMarks } from "@/lib/marking-reads";
import { getSignedAssetUrl } from "@/lib/storage";
import { CandidateRecord } from "@/components/admin/candidate-record";
import { ProgrammeStatus } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/lib/rbac";

export default async function CandidateRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getCandidateForAdmin(id);
  if (!candidate) notFound();

  const [enrolments, payments, stalePending, activeProgrammes, marks] = await Promise.all([
    listCandidateEnrolments(id),
    listProgrammes({ status: ProgrammeStatus.ACTIVE }),
    listCandidateMarks(id),
  ]);

  let payments: Awaited<ReturnType<typeof listCandidatePayments>> = [];
  let stalePending = false;
  let canViewPayments = true;
  try {
    [payments, stalePending] = await Promise.all([listCandidatePayments(id), candidateHasStalePendingPayment(id)]);
  } catch (err) {
    if (!(err instanceof PermissionDeniedError)) throw err;
    canViewPayments = false;
  }

  const paymentsWithReceipt = payments.map((p) => ({
    ...p,
    receiptUrl: p.receiptAsset ? getSignedAssetUrl(p.receiptAsset.storageKey) : null,
  }));

  return (
    <CandidateRecord
      candidate={candidate}
      enrolments={enrolments}
      payments={paymentsWithReceipt}
      stalePending={stalePending}
      activeProgrammes={activeProgrammes.map((p) => ({ id: p.id, title: p.title, code: p.code }))}
      marks={marks}
    />
  );
}
