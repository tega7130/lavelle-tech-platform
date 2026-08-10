import "server-only";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, PaymentPurpose, type OfflinePaymentMode } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { PaymentNotPendingError } from "@/lib/payment-errors";
import { formatNaira } from "@/lib/format";

export interface OfflineRecordingInput {
  amountNaira: number;
  offlineReceivedOn: Date;
  offlineMode: OfflinePaymentMode;
  offlineReference: string;
  receiptAssetId: string;
  reconciliationNote: string;
}

/**
 * The offline recording, shared by both entry points (rule: "two entry
 * points, one action"). Compares the amount received against the
 * programme fee: exact or over runs the shared enrolment transaction
 * (confirmPayment); short records the money as received but leaves the
 * enrolment PENDING_PAYMENT and issues no candidate number — that branch
 * deliberately does NOT call confirmPayment, since running it would
 * enrol on a part payment.
 *
 * Deliberately kept free of any staff-auth import (unlike the Server
 * Actions that call it) — pulling in staff-auth.ts drags in next/headers
 * (via staff-session.ts's cookies() read), which breaks importing this
 * function from a plain Vitest test. The permission check belongs to
 * the caller, same as confirmPayment itself.
 */
export async function applyOfflineRecording(
  paymentId: string,
  data: OfflineRecordingInput,
  staffId: string,
  ipAddress: string | null
) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { enrolment: { include: { programme: true } } },
  });
  if (payment.status !== PaymentStatus.PENDING) throw new PaymentNotPendingError();
  if (payment.purpose !== PaymentPurpose.PROGRAMME_FEE || !payment.enrolment) {
    throw new Error("Offline recording is only supported for a programme-fee payment in this slice.");
  }

  const amountMinor = Math.round(data.amountNaira * 100);
  const expectedFeeMinor = payment.enrolment.programme.feeMinor;
  const offline = {
    amountMinor,
    offlineMode: data.offlineMode,
    offlineReference: data.offlineReference,
    offlineReceivedOn: data.offlineReceivedOn,
    receiptAssetId: data.receiptAssetId,
  };

  if (amountMinor < expectedFeeMinor) {
    // Part payment (rule 7/8): recorded as SUCCESS, enrolment stays pending, no candidate number.
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCESS,
          confirmedAt: new Date(),
          confirmedByStaffId: staffId,
          manualConfirmationNote: data.reconciliationNote,
          amountMinor,
          offlineMode: offline.offlineMode,
          offlineReference: offline.offlineReference,
          offlineReceivedOn: offline.offlineReceivedOn,
          receiptAssetId: offline.receiptAssetId,
          statementVerifiedAt: new Date(),
        },
      });
      await recordAuditEvent(tx, {
        actorStaffId: staffId,
        subjectType: "payment",
        subjectId: paymentId,
        action: "payment.recorded_offline",
        description: `Part payment of ${formatNaira(amountMinor)} recorded against a ${formatNaira(expectedFeeMinor)} fee — enrolment remains pending payment`,
        reason: data.reconciliationNote,
        ipAddress,
      });
    });
    return { enrolled: false, shortfallMinor: expectedFeeMinor - amountMinor };
  }

  const result = await confirmPayment(paymentId, {
    actorStaffId: staffId,
    reason: data.reconciliationNote,
    ipAddress,
    auditAction: "payment.recorded_offline",
    offline,
  });
  return { enrolled: !result.alreadyConfirmed, overpaidMinor: amountMinor > expectedFeeMinor ? amountMinor - expectedFeeMinor : 0 };
}
