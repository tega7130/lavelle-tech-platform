import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

// Plain, no "server-only" — kept importable from Vitest like every other
// core-lib file. The route handler resolves ip/userAgent from headers()
// and passes them in.

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export interface VerifyRecord {
  certificateNumber: string;
  holderName: string;
  candidateNumber: string | null;
  programmeTitle: string;
  tier: string;
  band: string;
  issuedAt: string;
  status: string;
}

export interface VerifyResult {
  result: "valid" | "revoked" | "superseded" | "not_found";
  record?: VerifyRecord;
  revokedAt?: string;
  revokedReason?: string;
  successorNumber?: string | null; // what replaced this one, if anything
  predecessorNumber?: string | null; // what this one replaced, if anything
}

/**
 * The public lookup (rule 10) — rate-limited by IP, and the response is
 * built from an explicit allow-list of fields (VerifyRecord above), never
 * a spread of the Certificate row: no email, no phone, no other
 * credentials held, nothing beyond what the README's field list names.
 * Every lookup is logged, hit or miss (rule: "how often a credential is
 * checked is meaningful"), with the IP hashed, never stored raw.
 */
export async function verifyCertificate(rawNumber: string, ip: string | null, userAgent: string | null): Promise<VerifyResult> {
  if (ip) await enforceRateLimit("verify", { ip }, { limit: 20, windowSeconds: 60 });

  const queriedNumber = rawNumber.trim();
  const certificate = await prisma.certificate.findFirst({
    where: { certificateNumber: { equals: queriedNumber, mode: "insensitive" } },
    include: {
      supersededBy: { select: { certificateNumber: true } },
      replaces: { select: { certificateNumber: true } },
    },
  });

  const result: VerifyResult["result"] = !certificate
    ? "not_found"
    : certificate.status === "REVOKED"
      ? "revoked"
      : certificate.status === "SUPERSEDED"
        ? "superseded"
        : "valid";

  await prisma.verificationLookup.create({
    data: {
      queriedNumber,
      certificateId: certificate?.id ?? null,
      result,
      ipHash: ip ? hashIp(ip) : null,
      userAgent,
    },
  });
  if (certificate) {
    await prisma.certificate.update({ where: { id: certificate.id }, data: { verificationCount: { increment: 1 } } });
  }

  if (!certificate) return { result: "not_found" };

  return {
    result,
    record: {
      certificateNumber: certificate.certificateNumber,
      holderName: certificate.holderName,
      candidateNumber: certificate.candidateNumber,
      programmeTitle: certificate.programmeTitle,
      tier: certificate.tier,
      band: certificate.band,
      issuedAt: certificate.issuedAt.toISOString(),
      status: certificate.status,
    },
    revokedAt: certificate.revokedAt?.toISOString(),
    revokedReason: certificate.revokedReason ?? undefined,
    successorNumber: certificate.supersededBy?.certificateNumber ?? null,
    predecessorNumber: certificate.replaces?.certificateNumber ?? null,
  };
}
