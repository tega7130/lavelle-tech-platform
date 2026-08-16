import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// No "server-only" here, deliberately — same discipline as
// certificate-pdf.ts, so the release-gate math stays importable from
// Vitest without a browser-only stub.

// Signed, expiring download links (same HMAC shape as
// certificate-pdf.ts's getSignedCertificatePdfUrl, reusing its secret).
function pdfLinkSecret(): string {
  const s = process.env.UPLOAD_SIGNING_SECRET;
  if (!s) throw new Error("UPLOAD_SIGNING_SECRET is not set");
  return s;
}

function signPdfLink(payload: string): string {
  return crypto.createHmac("sha256", pdfLinkSecret()).update(payload).digest("hex");
}

const PDF_LINK_TTL_SECONDS = 300;

export function getSignedAdmissionSlipPdfUrl(registrationId: string, ttlSeconds = PDF_LINK_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const sig = signPdfLink(`GET:${registrationId}:${expiresAt}`);
  return `/api/exam-registrations/${registrationId}/admission-slip?exp=${expiresAt}&sig=${sig}`;
}

export function verifyAdmissionSlipPdfLink(registrationId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  const expected = signPdfLink(`GET:${registrationId}:${exp}`);
  const bufA = Buffer.from(expected);
  const bufB = Buffer.from(sig);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Released two weeks ahead of the window opening — a computed gate, not a stored flag, so there is nothing for an admin to forget to flip. */
export function admissionSlipReleasedAt(windowOpensAt: Date): Date {
  return new Date(windowOpensAt.getTime() - 14 * 24 * 60 * 60 * 1000);
}

export function isAdmissionSlipReleased(windowOpensAt: Date, now = new Date()): boolean {
  return now >= admissionSlipReleasedAt(windowOpensAt);
}

/** A stable, human-quotable seat reference — derived, not stored, from the registration id itself. */
export function seatReferenceFor(registrationId: string): string {
  return `LVL-SEAT-${registrationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export interface AdmissionSlipPdfInput {
  candidateName: string;
  candidateNumber: string;
  programmeTitle: string;
  tierLabel: string;
  registrationId: string;
  windowOpensAt: Date;
  durationMinutes: number;
  paymentReference: string;
}

const NAVY = rgb(0x13 / 255, 0x1a / 255, 0x2e / 255);
const BLUE = rgb(0x16 / 255, 0x68 / 255, 0xe3 / 255);
const GOLD = rgb(0xff / 255, 0xc6 / 255, 0x29 / 255);
const GREY = rgb(0x6d / 255, 0x77 / 255, 0x89 / 255);

function label(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text.toUpperCase(), { x, y, size: 8, font, color: GREY });
}

/** Portrait A4, rendered with pdf-lib's own vector primitives — same discipline as certificate-pdf.ts's renderCertificatePdf, no raster artwork dependency. */
export async function renderAdmissionSlipPdf(input: AdmissionSlipPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // portrait A4, in points
  const { width, height } = page.getSize();

  const heading = await doc.embedFont(StandardFonts.TimesRomanBold);
  const bodyBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: BLUE, borderWidth: 2 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: GOLD, borderWidth: 1 });

  page.drawText("LAVELLE INSTITUTE", { x: 60, y: height - 80, size: 13, font: bodyBold, color: BLUE });
  page.drawText("Admission Slip", { x: 60, y: height - 112, size: 24, font: heading, color: NAVY });

  let y = height - 170;
  const rows: [string, string][] = [
    ["Candidate", input.candidateName],
    ["Candidate number", input.candidateNumber],
    ["Examination", `${input.programmeTitle} — ${input.tierLabel} tier`],
    [
      "Sitting window opens",
      `${input.windowOpensAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${input.windowOpensAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} WAT`,
    ],
    ["Duration once started", `${input.durationMinutes / 60} hours`],
    ["Format", "Remote, proctored"],
    ["Seat reference", seatReferenceFor(input.registrationId)],
    ["Payment reference", input.paymentReference],
  ];
  for (const [k, v] of rows) {
    label(page, k, 60, y, bodyBold);
    page.drawText(v, { x: 60, y: y - 16, size: 12, font: body, color: NAVY });
    y -= 46;
  }

  page.drawText("Have this reference and a valid photo ID ready before you begin your sitting.", {
    x: 60,
    y: 110,
    size: 10,
    font: body,
    color: GREY,
  });
  const issuedLabel = `Issued ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  page.drawText(issuedLabel, { x: 60, y: 76, size: 10, font: body, color: GREY });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
