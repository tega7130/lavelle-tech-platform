import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBlob } from "@/lib/storage";
import { verifyCertificatePdfLink } from "@/lib/certificate-pdf";

/**
 * Signed, expiring (rule 8) — and 403s when revoked, checked fresh here
 * on every request, never trusted from whatever was true when the link
 * was minted. "A revoked certificate that still downloads is worse than
 * none at all." Superseded is deliberately NOT blocked — it was never
 * invalid, only replaced, so its own record stays a real document.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exp = request.nextUrl.searchParams.get("exp");
  const sig = request.nextUrl.searchParams.get("sig");
  if (!verifyCertificatePdfLink(id, exp, sig)) {
    return NextResponse.json({ error: "invalid_or_expired_link" }, { status: 403 });
  }

  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (certificate.status === "REVOKED") return NextResponse.json({ error: "revoked" }, { status: 403 });
  if (!certificate.pdfAssetId) return NextResponse.json({ error: "no_pdf" }, { status: 404 });

  const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: certificate.pdfAssetId } });
  const bytes = await readBlob(asset.storageKey);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${certificate.certificateNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
