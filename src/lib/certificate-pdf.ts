import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/**
 * Query-param form, matching the actual /verify page (src/app/verify/page.tsx
 * reads `?number=`, there is no `/verify/[number]` route) — NOT the path-
 * segment form certificate-actions.ts's email link uses, which 404s
 * regardless of certificate number format and is a separate, pre-existing
 * bug this file doesn't touch. encodeURIComponent also makes this safe for
 * the "/" the LAV-TILL YYYY/NNN format carries, which a path segment can't.
 */
function verifyUrlFor(certificateNumber: string): string {
  return `${appBaseUrl()}/verify?number=${encodeURIComponent(certificateNumber)}`;
}

// No "server-only" here, deliberately — issueCertificate (a plain
// function, called by Slice 06's releaseResults) needs this importable
// from Vitest, same discipline as every other core-lib file in this
// project.

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
}

const NAME_COLOR = rgb(0.05, 0.06, 0.09);
const BODY_COLOR = rgb(0.11, 0.16, 0.28);
const NUMBER_COLOR = rgb(0.44, 0.47, 0.53);

// Landscape A4 in points, matching the rasterized background's own aspect
// ratio exactly (2527x1786 @ 3x) so it's never stretched.
const PAGE_WIDTH = 842.25;
const PAGE_HEIGHT = 595.5;

// Left margin every dynamic field shares with the static "THIS IS TO
// CERTIFY THAT" label already baked into the background, and the right
// edge dynamic text must not cross — both read directly off the source
// design (see the PR description for how these were measured).
const CONTENT_LEFT = 300;
const CONTENT_RIGHT = 820;

/** Backing artwork is a one-time rasterization of the supplied Lavelle Certificate.svg (see src/assets/certificate-background.png) — read once, reused across every render in this process. */
let backgroundPngCache: Buffer | null = null;
function loadBackgroundPng(): Buffer {
  if (!backgroundPngCache) {
    backgroundPngCache = fs.readFileSync(path.join(process.cwd(), "src/assets/certificate-background.png"));
  }
  return backgroundPngCache;
}

/** Greedy word-wrap to a fixed pixel width. */
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

/** Width of `text` drawn letter-by-letter with `tracking` extra points after every character except the last — mirrors drawTrackedText so a fit check and the actual draw never disagree. */
function trackedTextWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  const chars = Array.from(text);
  let w = 0;
  chars.forEach((ch, i) => {
    w += font.widthOfTextAtSize(ch, size);
    if (i < chars.length - 1) w += tracking;
  });
  return w;
}

/** pdf-lib has no native letter-spacing — the source design's name line is visibly wide-tracked, so each character is placed by hand. */
function drawTrackedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  tracking: number
) {
  let cursor = x;
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

/**
 * Renders the Lavelle certificate — the supplied Lavelle Certificate.svg
 * (public/Images/Lavelle Certificate.svg), rasterized once to
 * src/assets/certificate-background.png, is drawn full-bleed as the page
 * background, then the three candidate-specific fields (name, programme,
 * certificate number) are painted on top at the positions the source
 * design itself uses for its "John Doe" / "Tech Law Lauchpad Programme" /
 * "LAV-TILL 2026/001" placeholders. A white rectangle first covers each
 * placeholder's exact footprint — the background is a flattened raster
 * (the source SVG has no real <text> nodes to edit directly, only
 * outlined paths — a known Canva SVG-export limitation), so masking then
 * redrawing is the only way to make the field dynamic without visibly
 * doubling the old placeholder text underneath the new one. Every other
 * element of the design (logo, wave, medal, signature, wording) is
 * untouched, baked into the background exactly as supplied.
 */
export async function renderCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const bg = await doc.embedPng(loadBackgroundPng());
  page.drawImage(bg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const heading = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);

  // ── Candidate name — one line, wide-tracked caps, shrinks to fit ──
  const displayName = input.holderName.toUpperCase();
  const nameMaxWidth = CONTENT_RIGHT - CONTENT_LEFT;
  const nameTracking = (size: number) => size * 0.08;
  let nameSize = 34;
  while (nameSize > 14 && trackedTextWidth(displayName, heading, nameSize, nameTracking(nameSize)) > nameMaxWidth) {
    nameSize -= 1;
  }
  page.drawRectangle({ x: 260, y: 230.5, width: 575, height: 85, color: rgb(1, 1, 1) });
  drawTrackedText(page, displayName, CONTENT_LEFT, 250.5, nameSize, heading, NAME_COLOR, nameTracking(nameSize));

  // ── Body sentence — the source design's fixed wording, programme
  // name substituted in; wraps and shrinks to stay within the space the
  // source design leaves before the signature block ──
  const programmeTitle = /^the\s/i.test(input.programmeTitle) ? input.programmeTitle : `the ${input.programmeTitle}`;
  const sentence = `has successfully completed ${programmeTitle} Programme delivered by Lavelle Development Technologies Limited`;
  const bodyMaxWidth = CONTENT_RIGHT - CONTENT_LEFT;
  let bodySize = 14.5;
  let bodyLines = wrapText(sentence, body, bodySize, bodyMaxWidth);
  while (bodyLines.length > 3 && bodySize > 10) {
    bodySize -= 0.5;
    bodyLines = wrapText(sentence, body, bodySize, bodyMaxWidth);
  }
  page.drawRectangle({ x: 260, y: 150, width: 575, height: 68, color: rgb(1, 1, 1) });
  const bodyLineHeight = 24 * (bodySize / 14.5);
  bodyLines.forEach((line, i) => {
    page.drawText(line, { x: CONTENT_LEFT, y: 195.5 - i * bodyLineHeight, size: bodySize, font: body, color: BODY_COLOR });
  });

  // ── Certificate number — fixed label, dynamic number, right-aligned
  // to the same margin the source design uses ──
  const numberLine = `Certificate Number: ${input.certificateNumber}`;
  const numberSize = 13.5;
  page.drawRectangle({ x: 545, y: 3.5, width: 290, height: 47, color: rgb(1, 1, 1) });
  const numberWidth = body.widthOfTextAtSize(numberLine, numberSize);
  page.drawText(numberLine, { x: 828 - numberWidth, y: 15.5, size: numberSize, font: body, color: NUMBER_COLOR });

  // ── QR code — bottom-left, under the logo, same line as the
  // certificate number — links to the public verify page ──
  const verifyUrl = verifyUrlFor(input.certificateNumber);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 240 });
  const qrImage = await doc.embedPng(qrDataUrl);
  const qrSize = 44;
  page.drawImage(qrImage, { x: 40, y: 4, width: qrSize, height: qrSize });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
