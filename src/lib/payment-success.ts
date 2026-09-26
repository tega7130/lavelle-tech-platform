import "server-only";
import { prisma } from "@/lib/prisma";
import type { Payment } from "@/generated/prisma/client";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { confirmDocumentPurchase } from "@/lib/document-purchase";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

/**
 * Confirms the payment and fires (fire-and-forget, never blocking the
 * caller) the purpose-specific confirmation emails. Shared by every
 * SUCCESS trigger — the real Nomba webhook and the beta no-payment
 * bypass (see simulateBetaPaymentSuccess below) both call this, so there
 * is exactly one place that decides what "a payment succeeded" means.
 */
export async function handlePaymentSuccess(payment: Payment) {
  // Document purchases are a separate, simpler path — no enrolment,
  // cohort or ID-card machinery, and no email (Phase 2 rule: no email
  // notifications for these actions) — so this branches off before ever
  // reaching confirmPayment, rather than teaching that function a third,
  // unrelated purpose.
  if (payment.purpose === "DOCUMENT_PURCHASE") {
    await confirmDocumentPurchase(payment.id);
    return;
  }

  const result = await confirmPayment(payment.id, { auditAction: "payment.confirmed" });
  if (result.alreadyConfirmed) return;

  // Awaited (both call sites already await handlePaymentSuccess itself)
  // — not a detached IIFE. On the serverless runtime an un-awaited
  // promise can be killed before it ever reaches sendEmail, so the
  // payment receipt would silently never send — the one email in this
  // whole codebase a candidate is most likely to actually go looking for.
  try {
    const currentYear = new Date().getFullYear();

    if (result.paymentPurpose === "PROGRAMME_FEE" && result.programme) {
      await sendTransactionalEmailByTemplate("payment-received-enrolment", result.candidate.email, {
        firstName: getFirstName(result.candidate.firstName),
        programmeName: result.programme.title,
        amountPaid: (result.confirmedAmount / 100).toFixed(2),
        paymentDate: payment.confirmedAt?.toLocaleDateString() || new Date().toLocaleDateString(),
        transactionId: payment.internalReference,
        paymentMethod: payment.provider || "unknown",
        tier: result.programme.tier,
        programmeAccessUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${result.programme.id}`,
        invoiceUrl: `${process.env.NEXTAUTH_URL}/invoices/${payment.id}`,
        supportEmail: EMAIL_CONFIG.supportEmail,
        currentYear,
      });

      if (result.enrolmentId) {
        const enrolment = await prisma.enrolment.findUniqueOrThrow({
          where: { id: result.enrolmentId },
          include: { intake: true },
        });
        const modules = await prisma.module.findMany({
          where: { programmeId: result.programme.id },
          include: { lectures: { select: { id: true, narrationMode: true } } },
        });
        const lectures = modules.flatMap((m) => m.lectures);
        const lectureCount = lectures.length;
        const hasNarrations = lectures.some((l) => l.narrationMode !== "NONE");
        const lectureDescription = `${lectureCount} recorded lecture${lectureCount !== 1 ? "s" : ""}${hasNarrations ? " with narration" : ""}`;
        const fullProgramme = await prisma.programme.findUniqueOrThrow({ where: { id: result.programme.id } });

        await sendTransactionalEmailByTemplate("enrolment-confirmation", result.candidate.email, {
          firstName: getFirstName(result.candidate.firstName),
          programmeName: result.programme.title,
          tier: result.programme.tier,
          duration: (fullProgramme as any).durationWeeks ? `${(fullProgramme as any).durationWeeks} weeks` : "TBD",
          weeklyCommitment: (fullProgramme as any).weeklyHours ? `${(fullProgramme as any).weeklyHours} hours` : "TBD",
          startDate: enrolment.intake?.startsAt?.toLocaleDateString() || "You can commence right now",
          lectureDescription,
          portalUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${result.programme.id}`,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear,
        });
      }
    } else if (result.paymentPurpose === "EXAMINATION_FEE" && result.programme) {
      const registration = await prisma.examRegistration.findFirst({
        where: { paymentId: payment.id },
        include: { window: true, exam: true },
      });

      if (registration) {
        const examDurationStr = registration.exam?.durationMinutes ? `${registration.exam.durationMinutes} minutes` : "TBD";

        await sendTransactionalEmailByTemplate("exam-registration-confirmed", result.candidate.email, {
          firstName: getFirstName(result.candidate.firstName),
          programmeName: result.programme.title,
          tier: result.programme.tier,
          examDate: registration.window?.opensAt?.toLocaleDateString() || "TBD",
          examDuration: examDurationStr,
          admissionSlipUrl: `${process.env.NEXTAUTH_URL}/exams/${registration.id}/admission-slip`,
          examRulesUrl: `${process.env.NEXTAUTH_URL}/exams/rules`,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear,
        });
      }
    }
  } catch (emailError) {
    console.error("Failed to send transactional email:", emailError);
    // Do not fail the confirmation on email errors — log and continue
  }
}

/**
 * Beta-only path (gated by NOMBA_BYPASS_ENABLED — see isNombaBypassEnabled
 * in payment-provider.ts): while this environment has no live Nomba
 * credentials, initiatePayment and initiateGuestCheckout call this
 * instead of ever creating a Nomba checkout order. The provider is
 * overwritten to "beta_no_payment" first so every one of these rows stays
 * permanently greppable/filterable out of real revenue, even after the
 * bypass is switched off — then it runs through the exact same
 * confirmation + email path a real Nomba webhook would.
 */
export async function simulateBetaPaymentSuccess(paymentId: string): Promise<void> {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { provider: "beta_no_payment" },
  });
  await handlePaymentSuccess(payment);
}
