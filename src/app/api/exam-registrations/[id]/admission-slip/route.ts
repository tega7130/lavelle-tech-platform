import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdmissionSlipPdfLink, isAdmissionSlipReleased, renderAdmissionSlipPdf } from "@/lib/admission-slip-pdf";
import { tierLabel } from "@/lib/format";

/** Signed, expiring (mirrors /api/certificates/[id]/pdf) — release gate re-checked fresh on every request, never trusted from when the link was minted. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exp = request.nextUrl.searchParams.get("exp");
  const sig = request.nextUrl.searchParams.get("sig");
  if (!verifyAdmissionSlipPdfLink(id, exp, sig)) {
    return NextResponse.json({ error: "invalid_or_expired_link" }, { status: 403 });
  }

  const registration = await prisma.examRegistration.findUnique({
    where: { id },
    include: {
      candidate: true,
      window: true,
      payment: true,
      exam: { include: { programme: true } },
    },
  });
  if (!registration) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (registration.payment?.status !== "SUCCESS") return NextResponse.json({ error: "not_paid" }, { status: 403 });
  if (!isAdmissionSlipReleased(registration.window.opensAt)) {
    return NextResponse.json({ error: "not_yet_released" }, { status: 403 });
  }

  const bytes = await renderAdmissionSlipPdf({
    candidateName: `${registration.candidate.firstName} ${registration.candidate.lastName}`,
    candidateNumber: registration.candidate.candidateNumber ?? registration.candidate.applicantNumber,
    programmeTitle: registration.exam.programme.title,
    tierLabel: tierLabel(registration.exam.programme.tier),
    registrationId: registration.id,
    windowOpensAt: registration.window.opensAt,
    durationMinutes: registration.exam.durationMinutes,
    paymentReference: registration.payment.internalReference,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="admission-slip-${registration.exam.programme.code}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
