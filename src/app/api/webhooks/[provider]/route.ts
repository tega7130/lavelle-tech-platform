import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma, PaymentStatus } from "@/generated/prisma/client";
import { verifyWebhookSignature } from "@/lib/payment-provider";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { recordAuditEvent } from "@/lib/audit";

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
      await confirmPayment(payment.id, { auditAction: "payment.confirmed" });
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
