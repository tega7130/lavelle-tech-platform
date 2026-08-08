"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button, buttonClassName } from "@/components/ui/button";
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
        <div className="flex items-center gap-2 mt-2">
          <Tag variant="accent">{tierLabel(c.tier)}</Tag>
          <Tag variant={STATUS_TAG[c.status]}>{c.status === "ACTIVE" ? "Active" : c.status === "REVOKED" ? "Revoked" : "Superseded"}</Tag>
        </div>
        <h1 className="font-heading text-2xl mt-2 mb-0">{c.programmeTitle}</h1>
      </div>

      <Card elev="md" className={revoked ? "border-[#f3c4bf]" : superseded ? "border-neutral-300" : "border-accent-2-300"}>
        <div className="text-center py-6">
          <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Lavelle Institute</div>
          <div
            className="font-heading font-bold text-[22px] mt-2"
            style={revoked ? { textDecoration: "line-through", color: "var(--color-neutral-500)" } : undefined}
          >
            {c.certificateNumber}
          </div>
          <div className="font-heading font-semibold text-[17px] mt-3">{c.holderName}</div>
          <div className="text-neutral-600 text-[13px] mt-1">
            {tierLabel(c.tier)} tier — {BAND_LABEL[c.band]}
          </div>
        </div>

        <div className="pt-4 border-t border-dashed border-neutral-300 text-[12.5px] text-neutral-700 text-center">
          {c.pathway === "PATHWAY"
            ? "Awarded for completing the programme and passing its certifying examination."
            : "Awarded by certifying examination."}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Final mark</div>
            <div className="text-[13px] font-medium mt-0.5">{c.finalPercent}%</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Issued</div>
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
          View public verification
        </Link>
      </div>
    </div>
  );
}
