import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, PaymentStatus } from "@/generated/prisma/client";
import { verifyWebhookSignature } from "@/lib/payment-provider";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { recordAuditEvent } from "@/lib/audit";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

const webhookBodySchema = z.object({
  event: z.enum(["charge.success", "charge.failed"]),
  data: z.object({
    reference: z.string().min(1), // our internalReference
    providerEventId: z.string().min(1),
    failureReason: z.string().optional(),
  }),
});

/**
 * Provider callback. Verify the signature over the RAW body before ever
 * attempting to parse it as JSON (rule 5) — an unsigned or mis-signed
 * request never reaches the parser, let alone the database. WebhookEvent
 * is inserted before any processing; a unique-constraint conflict on
 * (provider, providerEventId) means this delivery has already been
 * handled, so the correct response is 200 and no further action — never
 * check payment status alone to decide that, which races against a
 * concurrent delivery of the same event.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawBody = await request.text();
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

  const parsed = webhookBodySchema.safeParse(json);
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
      // Already handled — this delivery is a retry of one we've seen.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  const payment = await prisma.payment.findUnique({ where: { internalReference: data.reference } });
  if (payment) {
    if (event === "charge.success") {
      const result = await confirmPayment(payment.id, { auditAction: "payment.confirmed" });

      // Send emails asynchronously — do not block the webhook response on email failures
      if (!result.alreadyConfirmed) {
        (async () => {
          try {
            const currentYear = new Date().getFullYear();

            if (result.paymentPurpose === "PROGRAMME_FEE" && result.programme) {
              // Send payment-received-enrolment email
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

              // Send enrolment-confirmation email (only if enrolment is active)
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

                // Fetch full programme to get duration/commitment details if available
                const fullProgramme = await prisma.programme.findUniqueOrThrow({
                  where: { id: result.programme.id },
                });

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
              // Send exam-registration-confirmed email
              const registration = await prisma.examRegistration.findFirst({
                where: { paymentId: payment.id },
                include: { window: true, exam: true },
              });

              if (registration) {
                const examDurationStr = registration.exam?.durationMinutes
                  ? `${registration.exam.durationMinutes} minutes`
                  : "TBD";

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
    } else if (payment.status === PaymentStatus.PENDING) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failedAt: new Date(), failureReason: data.failureReason ?? "Declined by provider" },
      });
      await recordAuditEvent(prisma, {
        subjectType: "payment",
        subjectId: payment.id,
        action: "payment.failed",
        description: `Payment declined by ${provider}`,
        reason: data.failureReason ?? null,
      });
    }
  }

  await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { processedAt: new Date() } });

  return NextResponse.json({ ok: true });
}
