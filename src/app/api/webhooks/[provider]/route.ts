import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, PaymentStatus, type Payment } from "@/generated/prisma/client";
import { verifyWebhookSignature, verifyNombaWebhookSignature, type NombaWebhookPayload } from "@/lib/payment-provider";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { recordAuditEvent } from "@/lib/audit";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

const stubWebhookBodySchema = z.object({
  event: z.enum(["charge.success", "charge.failed"]),
  data: z.object({
    reference: z.string().min(1), // our internalReference
    providerEventId: z.string().min(1),
    failureReason: z.string().optional(),
  }),
});

const nombaWebhookBodySchema = z.object({
  event_type: z.string().min(1),
  requestId: z.string().min(1),
  data: z.object({
    merchant: z.object({ userId: z.string().optional(), walletId: z.string().optional() }).optional(),
    transaction: z
      .object({
        transactionId: z.string().optional(),
        type: z.string().optional(),
        time: z.string().optional(),
        responseCode: z.string().optional(),
        responseCodeMessage: z.string().optional(),
        transactionAmount: z.number().optional(),
        merchantTxRef: z.string().optional(),
      })
      .optional(),
    order: z
      .object({
        orderReference: z.string().optional(),
        orderId: z.string().optional(),
        amount: z.number().optional(),
        customerEmail: z.string().optional(),
        currency: z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * Confirms the payment and fires (fire-and-forget, never blocking the
 * webhook response) the purpose-specific confirmation emails. Shared by
 * every provider branch below — the confirmation/email logic is entirely
 * about our own Payment/Enrolment rows, not provider-specific payload
 * shape, so it only needs the already-looked-up Payment row.
 */
async function handlePaymentSuccess(payment: Payment) {
  const result = await confirmPayment(payment.id, { auditAction: "payment.confirmed" });
  if (result.alreadyConfirmed) return;

  (async () => {
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
            include: { lectures: true },
          });
          const lectureCount = modules.reduce((sum, m) => sum + m.lectures.length, 0);
          const fullProgramme = await prisma.programme.findUniqueOrThrow({ where: { id: result.programme.id } });

          await sendTransactionalEmailByTemplate("enrolment-confirmation", result.candidate.email, {
            firstName: getFirstName(result.candidate.firstName),
            programmeName: result.programme.title,
            tier: result.programme.tier,
            duration: (fullProgramme as any).durationWeeks ? `${(fullProgramme as any).durationWeeks} weeks` : "TBD",
            weeklyCommitment: (fullProgramme as any).weeklyHours ? `${(fullProgramme as any).weeklyHours} hours` : "TBD",
            startDate: enrolment.intake?.startsAt?.toLocaleDateString() || "TBD",
            lectureCount,
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
      // Do not fail the webhook on email errors — log and continue
    }
  })();
}

async function handlePaymentFailure(payment: Payment, provider: string, failureReason: string | null) {
  if (payment.status !== PaymentStatus.PENDING) return;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.FAILED, failedAt: new Date(), failureReason: failureReason ?? "Declined by provider" },
  });
  await recordAuditEvent(prisma, {
    subjectType: "payment",
    subjectId: payment.id,
    action: "payment.failed",
    description: `Payment declined by ${provider}`,
    reason: failureReason,
  });
}

/**
 * Provider callback, one route per provider (dynamic [provider] segment).
 * "nomba" is the real, live path — configured on the Nomba dashboard
 * under Developer > Webhook Setup, using Nomba's actual payload shape and
 * HMAC scheme (see verifyNombaWebhookSignature). Every other provider
 * value falls through to this app's own generic scheme, used only by the
 * local /pay/stub dev simulator (never a real payment provider).
 *
 * WebhookEvent is inserted before any processing; a unique-constraint
 * conflict on (provider, providerEventId) means this delivery has already
 * been handled, so the correct response is 200 and no further action —
 * never check payment status alone to decide that, which races against a
 * concurrent delivery of the same event.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawBody = await request.text();

  if (provider === "nomba") {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = nombaWebhookBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
    }
    const payload = parsed.data as NombaWebhookPayload;

    const signature = request.headers.get("nomba-signature") ?? request.headers.get("nomba-sig-value");
    const timestamp = request.headers.get("nomba-timestamp") ?? "";
    if (!verifyNombaWebhookSignature(payload, timestamp, signature)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    let webhookEvent;
    try {
      webhookEvent = await prisma.webhookEvent.create({
        data: { provider, providerEventId: payload.requestId, payload: json as Prisma.InputJsonValue, signatureValid: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw e;
    }

    const orderReference = payload.data.order?.orderReference;
    const payment = orderReference ? await prisma.payment.findUnique({ where: { internalReference: orderReference } }) : null;

    if (payment) {
      if (payload.event_type === "payment_success") {
        await handlePaymentSuccess(payment);
      } else if (payload.event_type === "payment_failed") {
        await handlePaymentFailure(payment, provider, payload.data.transaction?.responseCodeMessage ?? null);
      }
      // Other subscribed event types (payout_*, payment_reversal) don't apply to checkout payments — acknowledge only.
    }

    await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  // Generic scheme — the local /pay/stub dev simulator only, never a real provider.
  const signature = request.headers.get("x-lavelle-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = stubWebhookBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { event, data } = parsed.data;

  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { provider, providerEventId: data.providerEventId, payload: json as Prisma.InputJsonValue, signatureValid: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  const payment = await prisma.payment.findUnique({ where: { internalReference: data.reference } });
  if (payment) {
    if (event === "charge.success") {
      await handlePaymentSuccess(payment);
    } else {
      await handlePaymentFailure(payment, provider, data.failureReason ?? null);
    }
  }

  await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
