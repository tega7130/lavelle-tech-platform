import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

// No "server-only" here, deliberately — issueCertificate (a plain
// function, called by Slice 06's releaseResults) needs this importable
// from Vitest, same discipline as every other core-lib file in this
// project.

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/** The QR on the printed certificate resolves here, pre-filled — same URL the "Verify certificate" flow accepts by hand. */
export function verifyUrlFor(certificateNumber: string): string {
  return `${appBaseUrl()}/verify?number=${encodeURIComponent(certificateNumber)}`;
}

// Signed, expiring download links for GET /api/certificates/[id]/pdf
// (rule 8) — same HMAC sign/verify shape as the local storage shim
// (src/lib/storage.ts), reusing its secret rather than minting a new one.
function pdfLinkSecret(): string {
  const s = process.env.UPLOAD_SIGNING_SECRET;
  if (!s) throw new Error("UPLOAD_SIGNING_SECRET is not set");
  return s;
}

function signPdfLink(payload: string): string {
  return crypto.createHmac("sha256", pdfLinkSecret()).update(payload).digest("hex");
}

const PDF_LINK_TTL_SECONDS = 300;

export function getSignedCertificatePdfUrl(certificateId: string, ttlSeconds = PDF_LINK_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const sig = signPdfLink(`GET:${certificateId}:${expiresAt}`);
  return `/api/certificates/${certificateId}/pdf?exp=${expiresAt}&sig=${sig}`;
}

/**
 * Verifies the link's signature and expiry only — NOT whether the
 * certificate is revoked, which the route handler re-checks fresh on
 * every request regardless of what the link's signature attests to
 * (rule 8: a link minted before a revocation must not keep working).
 */
export function verifyCertificatePdfLink(certificateId: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  const expected = signPdfLink(`GET:${certificateId}:${exp}`);
  const bufA = Buffer.from(expected);
  const bufB = Buffer.from(sig);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface CertificatePdfInput {
  certificateNumber: string;
  holderName: string;
  programmeTitle: string;
  tierLabel: string;
  bandLabel: string;
  pathway: "PATHWAY" | "EXAMINATION_ONLY";
  issuedAt: Date;
  signatoryBlock: string;
}

const NAVY = rgb(0x13 / 255, 0x1a / 255, 0x2e / 255);
const BLUE = rgb(0x16 / 255, 0x68 / 255, 0xe3 / 255);
const GOLD = rgb(0xff / 255, 0xc6 / 255, 0x29 / 255);
const GREY = rgb(0x6d / 255, 0x77 / 255, 0x89 / 255);

function centerText(page: PDFPage, text: string, y: number, size: number, font: PDFFont, color = NAVY) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

/** Greedy word-wrap to a fixed pixel width — this text is short (one sentence), so a simple wrap is all it needs. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A real, valid, downloadable PDF rendered with pdf-lib's own vector
 * primitives (border, text, an embedded QR) rather than a raster artwork
 * background — this environment has no uploaded artwork with real pixel
 * bytes behind it (see prisma/seed.ts's placeholder MediaAsset), so a
 * template's `artworkAssetId` is a real row for the admin UI to manage,
 * not something this renderer reads from.
 */
export async function renderCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // landscape A4, in points
  const { width, height } = page.getSize();

  const heading = await doc.embedFont(StandardFonts.TimesRomanBold);
  const bodyBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: BLUE, borderWidth: 2 });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: GOLD, borderWidth: 1 });

  centerText(page, "LAVELLE INSTITUTE", height - 90, 15, bodyBold, BLUE);
  centerText(page, "Certificate of Award", height - 130, 28, heading, NAVY);

  centerText(page, "This is to certify that", height - 185, 12, body, GREY);
  centerText(page, input.holderName, height - 225, 26, heading, NAVY);

  const pathwayLine =
    input.pathway === "PATHWAY"
      ? `has completed the ${input.programmeTitle} programme and passed its certifying examination`
      : `has passed the certifying examination for ${input.programmeTitle}`;
  const wrapped = wrapText(pathwayLine, body, 13, width - 220);
  wrapped.forEach((line, i) => centerText(page, line, height - 270 - i * 18, 13, body, NAVY));

  centerText(page, `${input.tierLabel} tier — ${input.bandLabel}`, height - 270 - wrapped.length * 18 - 24, 15, bodyBold, BLUE);

  page.drawText(input.signatoryBlock, { x: 70, y: 92, size: 10, font: body, color: GREY });
  const issuedLabel = `Issued ${input.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  page.drawText(issuedLabel, { x: 70, y: 76, size: 10, font: body, color: GREY });
  page.drawText(input.certificateNumber, { x: width - 240, y: 76, size: 11, font: bodyBold, color: NAVY });

  const verifyUrl = verifyUrlFor(input.certificateNumber);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 240 });
  const qrImage = await doc.embedPng(qrDataUrl);
  const qrSize = 66;
  page.drawImage(qrImage, { x: width - qrSize - 70, y: 88, width: qrSize, height: qrSize });
  page.drawText("Scan to verify", { x: width - qrSize - 68, y: 78, size: 7, font: body, color: GREY });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
