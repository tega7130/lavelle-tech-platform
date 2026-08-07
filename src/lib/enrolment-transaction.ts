import "server-only";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, EnrolmentStatus, NotificationCategory, type OfflinePaymentMode } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { formatNaira } from "@/lib/format";

export interface OfflinePaymentFields {
  amountMinor: number; // the actual amount received — never silently truncated to the fee (rule 7)
  offlineMode: OfflinePaymentMode;
  offlineReference: string;
  offlineReceivedOn: Date;
  receiptAssetId: string;
}

export interface ConfirmPaymentOptions {
  /** Non-null only for a staff-initiated confirmation (manual confirm or offline recording). */
  actorStaffId?: string | null;
  /** Mandatory for a staff-initiated confirmation — written verbatim to audit_event.reason. */
  reason?: string | null;
  ipAddress?: string | null;
  auditAction: "payment.confirmed" | "payment.recorded_offline";
  /** Present only for an offline recording — written atomically alongside the SUCCESS transition. */
  offline?: OfflinePaymentFields;
}

export interface ConfirmPaymentResult {
  alreadyConfirmed: boolean;
  paymentId: string;
  enrolmentId: string | null;
  candidateNumberAssigned: boolean;
  cohortAssigned: boolean;
  cohortUnavailable: boolean;
}

/**
 * The single function every SUCCESS trigger calls — the verified webhook,
 * a manual confirmation, and an offline recording all funnel through
 * here, so there is one code path, not three (rule 1). Steps 2-8 of the
 * README's enrolment transaction, in one prisma.$transaction, with the
 * payment, candidate and cohort rows locked FOR UPDATE so two concurrent
 * callers can never both apply steps 3-8 for the same payment, and two
 * concurrent payments contending for the last cohort place serialize on
 * the cohort row rather than racing past the capacity check together.
 */
export async function confirmPayment(paymentId: string, opts: ConfirmPaymentOptions): Promise<ConfirmPaymentResult> {
  return prisma.$transaction(async (tx) => {
    // Step 1 — lock the payment row first, always, so every caller
    // acquires locks in the same order (payment -> candidate -> cohort)
    // and a retried webhook racing a manual confirmation blocks here
    // until the first transaction commits, then sees SUCCESS and returns
    // immediately without reapplying anything.
    const lockedRows = await tx.$queryRaw<
      { id: string; status: PaymentStatus; enrolmentId: string | null; candidateId: string; amountMinor: number }[]
    >`SELECT id, status, "enrolmentId", "candidateId", "amountMinor" FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
    const locked = lockedRows[0];
    if (!locked) throw new Error(`Payment ${paymentId} not found`);

    if (locked.status === PaymentStatus.SUCCESS) {
      return {
        alreadyConfirmed: true,
        paymentId,
        enrolmentId: locked.enrolmentId,
        candidateNumberAssigned: false,
        cohortAssigned: false,
        cohortUnavailable: false,
      };
    }

    // Step 2
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCESS,
        confirmedAt: new Date(),
        ...(opts.actorStaffId
          ? { confirmedByStaffId: opts.actorStaffId, manualConfirmationNote: opts.reason ?? undefined }
          : {}),
        ...(opts.offline
          ? {
              amountMinor: opts.offline.amountMinor,
              offlineMode: opts.offline.offlineMode,
              offlineReference: opts.offline.offlineReference,
              offlineReceivedOn: opts.offline.offlineReceivedOn,
              receiptAssetId: opts.offline.receiptAssetId,
              statementVerifiedAt: new Date(),
            }
          : {}),
      },
    });
    // The amount notifications/audit below quote — offline recordings can
    // exceed the snapshot taken at initiation, and this must reflect the
    // actual amount received, never the original.
    const confirmedAmountMinor = opts.offline?.amountMinor ?? locked.amountMinor;

    // Step 3 — lock the candidate row; assign a number only if null (a
    // second programme does not issue a second one).
    const candidateRows = await tx.$queryRaw<{ id: string; candidateNumber: string | null }[]>`
      SELECT id, "candidateNumber" FROM "Candidate" WHERE id = ${locked.candidateId}::uuid FOR UPDATE
    `;
    const candidateRow = candidateRows[0];
    if (!candidateRow) throw new Error(`Candidate ${locked.candidateId} not found`);
    let candidateNumber = candidateRow.candidateNumber;
    const candidateNumberAssigned = !candidateNumber;
    if (!candidateNumber) {
      const numRows = await tx.$queryRaw<{ next_candidate_number: string }[]>`SELECT next_candidate_number()`;
      candidateNumber = numRows[0]!.next_candidate_number;
      await tx.candidate.update({ where: { id: locked.candidateId }, data: { candidateNumber } });
    }

    let cohortAssigned = false;
    let cohortUnavailable = false;
    const enrolmentId = locked.enrolmentId;

    // Steps 4-6 only touch Enrolment/Cohort/IdCard for a programme-fee
    // payment (enrolmentId set). An examination-fee payment has no
    // enrolment to activate and stops after the candidate-number check.
    if (enrolmentId) {
      const enrolment = await tx.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } });

      // Step 5 — lock every cohort for this programme+intake (ordinarily
      // exactly one), oldest first, and take the first with room.
      // Occupancy is counted, never stored (rule 9): a denormalised
      // counter drifts on the first rolled-back transaction, and this
      // count gates enrolment.
      const cohortRows = await tx.$queryRaw<{ id: string; capacity: number }[]>`
        SELECT id, capacity FROM "Cohort"
        WHERE "programmeId" = ${enrolment.programmeId} AND "intakeId" = ${enrolment.intakeId}
        ORDER BY "createdAt" ASC
        FOR UPDATE
      `;
      let assignedCohortId: string | null = null;
      for (const c of cohortRows) {
        const occupied = await tx.enrolment.count({
          where: { cohortId: c.id, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
        });
        if (occupied < c.capacity) {
          assignedCohortId = c.id;
          break;
        }
      }
      if (assignedCohortId) cohortAssigned = true;
      else cohortUnavailable = true;

      // Step 4 — the money is taken either way; a placement problem is
      // not the candidate's to absorb, so ACTIVE does not wait on a cohort.
      await tx.enrolment.update({
        where: { id: enrolmentId },
        data: {
          status: EnrolmentStatus.ACTIVE,
          enrolledAt: new Date(),
          cohortId: assignedCohortId ?? enrolment.cohortId,
        },
      });

      if (cohortUnavailable) {
        // No dedicated admin-task queue exists in this schema — the
        // audit trail under this distinct action IS the task: it is what
        // a registrar reconciles against (findable via the audit log, or
        // a query for ACTIVE enrolments with cohortId still null).
        await recordAuditEvent(tx, {
          actorStaffId: opts.actorStaffId ?? null,
          subjectType: "enrolment",
          subjectId: enrolmentId,
          action: "enrolment.cohort_unavailable",
          description: `No cohort had room for programme ${enrolment.programmeId}, intake ${enrolment.intakeId} — payment confirmed, placement pending`,
        });
      }

      // Step 6
      const activeCard = await tx.idCard.findFirst({ where: { candidateId: locked.candidateId, retiredAt: null } });
      if (!activeCard) {
        const programme = await tx.programme.findUniqueOrThrow({ where: { id: enrolment.programmeId } });
        await tx.idCard.create({
          data: {
            candidateId: locked.candidateId,
            cardNumber: candidateNumber,
            tier: programme.tier,
            issuedAt: new Date(),
            // No expiry formula is specified — two years from issue,
            // rounded to the end of that calendar year, is this
            // institution's working default until a real one is set.
            validUntil: new Date(new Date().getFullYear() + 2, 11, 31),
          },
        });
      }

      // Step 7
      await tx.notification.create({
        data: {
          candidateId: locked.candidateId,
          category: NotificationCategory.FINANCE,
          title: "Payment confirmed",
          body: `Your payment of ${formatNaira(confirmedAmountMinor)} has been confirmed.`,
        },
      });
      await tx.notification.create({
        data: {
          candidateId: locked.candidateId,
          category: NotificationCategory.PROGRAMME,
          title: "You're enrolled",
          body: `Your enrolment is now active. Your candidate number is ${candidateNumber}.`,
        },
      });
    }

    // Step 8
    await recordAuditEvent(tx, {
      actorStaffId: opts.actorStaffId ?? null,
      subjectType: "payment",
      subjectId: paymentId,
      action: opts.auditAction,
      description: `Payment of ${formatNaira(confirmedAmountMinor)} confirmed`,
      reason: opts.reason ?? null,
      ipAddress: opts.ipAddress ?? null,
    });

    return { alreadyConfirmed: false, paymentId, enrolmentId, candidateNumberAssigned, cohortAssigned, cohortUnavailable };
  });
}
