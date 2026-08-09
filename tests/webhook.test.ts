import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { testPrisma } from "./db";
import { POST as webhookPost } from "@/app/api/webhooks/[provider]/route";
import { signWebhookPayload } from "@/lib/payment-provider";

async function seedProgramme() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Webhook Staff", email: `webhook-test-${crypto.randomUUID()}@example.com`, role: "FINANCE", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Webhook Test Category ${crypto.randomUUID()}`, slug: `webhook-test-${crypto.randomUUID()}` },
  });
  const programme = await testPrisma.programme.create({
    data: {
      code: `WHK-${crypto.randomUUID().slice(0, 8)}`,
      title: "Webhook Test Programme",
      categoryId: category.id,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: 45_000_000,
      createdByStaffId: staff.id,
    },
  });
  const intake = await testPrisma.intake.create({
    data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
  });
  return { staff, category, programme, intake };
}

async function seedCandidateWithPendingPayment(programmeId: string, intakeId: string, amountMinor: number) {
  const candidate = await testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Webhook",
      lastName: "Tester",
      email: `webhook-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId: candidate.id, programmeId, intakeId, status: "PENDING_PAYMENT" },
  });
  const payment = await testPrisma.payment.create({
    data: {
      candidateId: candidate.id,
      purpose: "PROGRAMME_FEE",
      enrolmentId: enrolment.id,
      amountMinor,
      provider: "paystack",
      internalReference: `LVL-PAY-TEST-${crypto.randomUUID()}`,
      status: "PENDING",
    },
  });
  return { candidate, enrolment, payment };
}

function buildRequest(body: string, signature: string | null) {
  return new NextRequest("http://localhost:3000/api/webhooks/paystack", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-lavelle-signature": signature } : {}),
    },
    body,
  });
}

describe("provider webhook — verify signature before parsing, idempotent on providerEventId", () => {
  it("the same delivery, retried five times, enrols exactly once", async () => {
    const fixture = await seedProgramme();
    const { candidate, payment } = await seedCandidateWithPendingPayment(fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);

    const providerEventId = crypto.randomUUID();
    const body = JSON.stringify({ event: "charge.success", data: { reference: payment.internalReference, providerEventId } });
    const signature = signWebhookPayload(body);

    for (let i = 0; i < 5; i++) {
      const res = await webhookPost(buildRequest(body, signature), { params: Promise.resolve({ provider: "paystack" }) });
      expect(res.status).toBe(200);
    }

    const webhookEvents = await testPrisma.webhookEvent.count({ where: { provider: "paystack", providerEventId } });
    expect(webhookEvents).toBe(1); // the unique constraint absorbed the other four

    const finalPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(finalPayment.status).toBe("SUCCESS");

    const auditCount = await testPrisma.auditEvent.count({ where: { subjectType: "payment", subjectId: payment.id, action: "payment.confirmed" } });
    expect(auditCount).toBe(1); // enrolled exactly once, not five times

    await testPrisma.webhookEvent.deleteMany({ where: { provider: "paystack", providerEventId } });
    await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.idCard.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.notification.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
    await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
    await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
    await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
  });

  it("a request with an invalid or missing signature is rejected before the body is ever parsed — the tampering path", async () => {
    const fixture = await seedProgramme();
    const { candidate, payment } = await seedCandidateWithPendingPayment(fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);

    const providerEventId = crypto.randomUUID();
    const body = JSON.stringify({ event: "charge.success", data: { reference: payment.internalReference, providerEventId } });

    const forged = await webhookPost(buildRequest(body, "0".repeat(64)), { params: Promise.resolve({ provider: "paystack" }) });
    expect(forged.status).toBe(401);

    const missing = await webhookPost(buildRequest(body, null), { params: Promise.resolve({ provider: "paystack" }) });
    expect(missing.status).toBe(401);

    // Neither attempt left any trace — no WebhookEvent inserted, payment untouched.
    const webhookEvents = await testPrisma.webhookEvent.count({ where: { provider: "paystack", providerEventId } });
    expect(webhookEvents).toBe(0);
    const finalPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(finalPayment.status).toBe("PENDING"); // a candidate editing the return URL / forging a callback enrols no one

    await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
    await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
    await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
    await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
