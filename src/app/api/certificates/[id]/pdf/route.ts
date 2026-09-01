import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { verifyCertificatePdfLink } from "@/lib/certificate-pdf";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

  const secureUrl = cloudinary.url(asset.storageKey, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    expiration: Math.floor(Date.now() / 1000) + 3600,
  });

  const response = await fetch(secureUrl);
  const bytes = await response.arrayBuffer();

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${certificate.certificateNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
