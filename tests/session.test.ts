import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { resolveCandidateFromToken, hashSessionToken } from "@/lib/candidate-session";

describe("candidate DB sessions", () => {
  let candidateId: string;

  beforeAll(async () => {
    const rows = await testPrisma.$queryRaw<{ next_applicant_number: string }[]>`SELECT next_applicant_number()`;
    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: rows[0]!.next_applicant_number,
        firstName: "Test",
        lastName: "Candidate",
        email: `session-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    candidateId = candidate.id;
  });

  afterAll(async () => {
    await testPrisma.candidate.delete({ where: { id: candidateId } });
    await testPrisma.$disconnect();
  });

  it("resolves a live, unexpired token to the candidate", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    await testPrisma.session.create({
      data: {
        candidateId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const resolved = await resolveCandidateFromToken(token);
    expect(resolved?.id).toBe(candidateId);
  });

  it("signs out immediately once the session row is revoked — the whole point of DB sessions over a stateless JWT", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    const session = await testPrisma.session.create({
      data: {
        candidateId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    expect((await resolveCandidateFromToken(token))?.id).toBe(candidateId);

    await testPrisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    expect(await resolveCandidateFromToken(token)).toBeNull();
  });

  it("treats an expired session as signed out", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    await testPrisma.session.create({
      data: {
        candidateId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    expect(await resolveCandidateFromToken(token)).toBeNull();
  });

  it("self-heals: a live session on a suspended account is revoked on read and treated as signed out", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    const session = await testPrisma.session.create({
      data: {
        candidateId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await testPrisma.candidate.update({
      where: { id: candidateId },
      data: { accountStatus: "SUSPENDED", suspendedAt: new Date(), suspendedReason: "test" },
    });

    expect(await resolveCandidateFromToken(token)).toBeNull();
    const reloaded = await testPrisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(reloaded.revokedAt).not.toBeNull();

    // restore for any later test in this file
    await testPrisma.candidate.update({
      where: { id: candidateId },
      data: { accountStatus: "ACTIVE", suspendedAt: null, suspendedReason: null },
    });
  });

  it("returns null for a token with no matching session at all", async () => {
    const token = crypto.randomBytes(32).toString("base64url");
    expect(await resolveCandidateFromToken(token)).toBeNull();
  });
});
