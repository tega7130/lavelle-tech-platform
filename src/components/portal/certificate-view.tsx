"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { tierLabel } from "@/lib/format";
import { getCertificateDownloadUrlAction } from "@/app/actions/certificates";
import type { getOwnCertificate } from "@/lib/certificate-candidate-reads";

type Certificate = NonNullable<Awaited<ReturnType<typeof getOwnCertificate>>>;

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };
const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "accent-2",
  REVOKED: "danger",
  SUPERSEDED: "neutral",
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function CertificateView({ certificate: c }: { certificate: Certificate }) {
  const [busy, setBusy] = React.useState(false);
  const revoked = c.status === "REVOKED";
  const superseded = c.status === "SUPERSEDED";
  const isPathway = c.pathway === "PATHWAY";
  const isCourseOnly = isPathway && !c.sittingId; // no certifying exam exists for this programme at all

  async function download() {
    setBusy(true);
    try {
      const url = await getCertificateDownloadUrlAction(c.id);
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[760px] flex flex-col gap-[var(--space-5)]">
      <div>
        <Link href="/portal/credentials" className="text-accent text-[12.5px] font-medium">
          ← All credentials
        </Link>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span className="text-[12.5px] text-neutral-600">
            Certificate {c.certificateNumber} &middot; issued {fmtDate(c.issuedAt)}
          </span>
          <Tag variant={STATUS_TAG[c.status]}>{c.status === "ACTIVE" ? "Active" : c.status === "REVOKED" ? "Revoked" : "Superseded"}</Tag>
          {isPathway && <Tag variant="accent-2">★ Lavelle pathway</Tag>}
        </div>
        <h1 className="font-heading text-2xl mt-2 mb-0">{c.programmeTitle}</h1>
      </div>

      {isCourseOnly ? (
        <div className="rounded-md bg-accent-2-100 border border-accent-2-300 px-4 py-3.5 text-[12.5px] leading-[1.6] text-accent-2-800">
          Credentialed via the Lavelle {c.programmeTitle} pathway — earned by completing every lecture and passing
          every module quiz. This programme carries no separate certifying examination.
        </div>
      ) : (
        isPathway && (
          <div className="rounded-md bg-accent-2-100 border border-accent-2-300 px-4 py-3.5 text-[12.5px] leading-[1.6] text-accent-2-800">
            Credentialed via the Lavelle {c.programmeTitle} pathway — the programme was completed in full before the
            certifying examination was sat. The pathway mark records how the credential was earned; it does not
            change its standing.
          </div>
        )
      )}

      <Card elev="md" className={`p-0 overflow-hidden ${revoked ? "border-[#f3c4bf]" : superseded ? "border-neutral-300" : "border-accent-2-300"}`}>
        <div className="border-[3px] border-double m-4 rounded-sm px-8 py-10 text-center" style={{ borderColor: "var(--color-accent-300)" }}>
          <LogoMark size={36} className="mx-auto" />
          <div className="font-heading font-bold text-[15px] mt-2.5 tracking-[0.01em]">LAVELLE INSTITUTE</div>
          <div className="text-neutral-500 text-[9.5px] tracking-[0.16em] uppercase mt-0.5">Professional Specialization</div>

          <div className="text-neutral-500 text-[11px] tracking-[0.08em] uppercase mt-8">This certifies that</div>
          <div
            className="font-heading font-bold text-[26px] mt-2"
            style={revoked ? { textDecoration: "line-through", color: "var(--color-neutral-500)" } : undefined}
          >
            {c.holderName}
          </div>

          <p className="text-neutral-700 text-[13.5px] leading-[1.6] max-w-[46ch] mx-auto mt-3">
            has satisfied the requirements of the {tierLabel(c.tier)} tier and is hereby awarded the certificate in
          </p>
          <div className="font-heading font-semibold text-[18px] text-accent mt-1.5">{c.programmeTitle}</div>

          <div className="mt-4">
            <Tag variant={c.band === "REFER" ? "danger" : "accent-2"} className="text-[12px] px-3 py-1">
              Awarded with {BAND_LABEL[c.band]}
            </Tag>
          </div>

          <div className="mt-8 pt-5 border-t border-dashed border-neutral-300 text-neutral-500 text-[11.5px]">
            {c.template.signatoryBlock}
          </div>
        </div>

        <div className="grid grid-cols-3 max-[540px]:grid-cols-1 gap-3 px-6 pb-5 -mt-1">
          <div>
            <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Certificate ID</div>
            <div className="text-[13px] font-medium mt-0.5">{c.certificateNumber}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Date of award</div>
            <div className="text-[13px] font-medium mt-0.5">{fmtDate(c.issuedAt)}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Candidate</div>
            <div className="text-[13px] font-medium mt-0.5">{c.candidateNumber ?? "—"}</div>
          </div>
        </div>
      </Card>

      {revoked && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-md bg-[#fef3f2] border border-[#f3c4bf]">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdecec] text-[#b42318] flex items-center justify-center text-sm font-bold">!</span>
          <div>
            <div className="font-heading font-semibold text-[13.5px] text-[#912019]">This certificate has been revoked</div>
            <div className="text-[#a03026] text-[12.5px] mt-1">{c.revokedReason}</div>
            {c.revokedAt && <div className="text-[#a03026] text-[11px] mt-1.5">Revoked {fmtDate(c.revokedAt)}</div>}
            <div className="text-[#a03026] text-[12.5px] mt-2">
              Your programme access, results and practice record are unaffected — only this credential is withdrawn.
            </div>
            {c.supersededBy && (
              <div className="text-[#a03026] text-[12.5px] mt-2">
                Replaced by{" "}
                <Link href={`/portal/credentials/${c.supersededBy.certificateNumber}`} className="font-medium underline">
                  {c.supersededBy.certificateNumber}
                </Link>
                .
              </div>
            )}
            <Link href="/portal/support" className="text-[12.5px] font-medium underline mt-2 inline-block text-[#912019]">
              Appeal this decision
            </Link>
          </div>
        </div>
      )}

      {superseded && c.supersededBy && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-md bg-neutral-100 border border-neutral-300">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-bold">
            i
          </span>
          <div>
            <div className="font-heading font-semibold text-[13.5px]">This certificate has been superseded</div>
            <div className="text-neutral-600 text-[12.5px] mt-1">
              It was not invalid — it was replaced. The current certificate is{" "}
              <Link href={`/portal/credentials/${c.supersededBy.certificateNumber}`} className="font-medium text-accent underline">
                {c.supersededBy.certificateNumber}
              </Link>
              .
            </div>
          </div>
        </div>
      )}

      {c.status === "ACTIVE" && c.replaces && (
        <Card elev="sm" className="bg-accent-100 border-accent-200">
          <div className="text-[12.5px] text-accent-800">Replaces the retired certificate {c.replaces.certificateNumber}.</div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={download} disabled={busy || revoked}>
          {revoked ? "Download unavailable" : busy ? "Preparing…" : "Download PDF"}
        </Button>
        <Link
          href={`/verify?number=${encodeURIComponent(c.certificateNumber)}`}
          target="_blank"
          className={buttonClassName("secondary")}
        >
          Verify on public portal
        </Link>
      </div>
    </div>
  );
}
