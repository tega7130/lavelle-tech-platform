"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { tierLabel } from "@/lib/format";
import type { VerifyResult } from "@/lib/certificate-verify";

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };
const SAMPLE_ID = "LVL-CERT-2025-00790";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function VerifyPortal({ initialNumber }: { initialNumber: string }) {
  const [query, setQuery] = React.useState(initialNumber);
  const [result, setResult] = React.useState<VerifyResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async (number: string) => {
    if (!number.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/verify?number=${encodeURIComponent(number.trim())}`);
      if (res.status === 429) {
        setError("Too many checks from this connection. Try again in a minute.");
        setResult(null);
        return;
      }
      const data: VerifyResult = await res.json();
      setResult(data);
    } catch {
      setError("Could not reach the verification service. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialNumber) void run(initialNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between gap-4 px-8 py-4 border-b border-divider">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex-none rounded-md bg-accent-2 flex items-center justify-center font-heading font-bold text-[16px] text-accent">
            L
          </div>
          <div>
            <div className="font-heading font-bold text-[15px]">Lavelle Institute</div>
            <div className="text-neutral-500 text-[10px] tracking-[0.08em] uppercase">Credential Verification Portal</div>
          </div>
        </div>
        <Link href="/sign-in" className="text-[13px] text-accent font-medium">
          Candidate portal →
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-16">
        <div className="w-full max-w-[560px]">
          <div className="text-center">
            <h1 className="font-heading text-3xl m-0">Verify a Lavelle credential</h1>
            <p className="text-neutral-600 text-[14px] mt-3">
              Enter the Certificate ID printed on the certificate to confirm its authenticity, the programme awarded, and the grade attained.
            </p>
          </div>

          <Card elev="md" className="p-6 mt-6">
            <Label>Certificate ID</Label>
            <Input
              placeholder="LVL-CERT-YYYY-NNNNN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run(query)}
            />
            <div className="flex justify-between items-center mt-3">
              <button className="text-neutral-500 text-[12px] cursor-pointer underline" onClick={() => setQuery(SAMPLE_ID)}>
                Try {SAMPLE_ID}
              </button>
              <Button onClick={() => run(query)} disabled={busy || !query.trim()}>
                {busy ? "Checking…" : "Verify certificate"}
              </Button>
            </div>
          </Card>

          {error && <div className="text-[#b42318] text-[12.5px] text-center mt-4">{error}</div>}

          {result && <ResultCard result={result} />}

          <div className="text-neutral-500 text-[12px] mt-8 text-center">
            Lavelle credentials are awarded on the Distinction / Merit / Pass / Refer scale across three tiers — Foundation, Specialist, and Advanced
            Practitioner. Verification is free and does not require an account.
          </div>
        </div>
      </main>
    </div>
  );
}

function ResultCard({ result }: { result: VerifyResult }) {
  if (result.result === "not_found") {
    return (
      <Card elev="md" className="p-6 mt-6 border-l-[3px] border-l-[#b42318]">
        <div className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdecec] text-[#b42318] flex items-center justify-center text-sm font-bold">!</span>
          <div className="font-heading font-bold text-[17px] text-[#b42318]">No matching credential</div>
        </div>
        <p className="text-neutral-700 text-[13.5px] mt-3">
          We could not find a certificate with that ID. Check the ID for transcription errors, or contact the registrar at{" "}
          <a href="mailto:registrar@lavelle.ng">registrar@lavelle.ng</a> if you believe a credential is being misrepresented.
        </p>
      </Card>
    );
  }

  const record = result.record!;
  const rows = [
    { label: "Certificate ID", value: record.certificateNumber },
    { label: "Holder", value: record.holderName },
    { label: "Candidate ID", value: record.candidateNumber ?? "—" },
    { label: "Programme", value: record.programmeTitle },
    { label: "Credential tier", value: tierLabel(record.tier) },
    { label: "Grade awarded", value: BAND_LABEL[record.band] ?? record.band },
    { label: "Date of award", value: fmtDate(record.issuedAt) },
    { label: "Status", value: result.result === "valid" ? "Valid — in good standing" : result.result === "revoked" ? "Revoked — may not be relied upon" : "Superseded — replaced by a later certificate" },
  ];

  if (result.result === "valid") {
    return (
      <Card elev="lg" className="p-6 mt-6 border-l-[3px] border-l-[#15803d]">
        <div className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#e7f6ed] text-[#15803d] flex items-center justify-center text-sm font-bold">✓</span>
          <div className="font-heading font-bold text-[17px] text-[#15803d]">Valid credential</div>
        </div>
        <div className="border-t border-dashed border-neutral-300 my-4" />
        <RecordRows rows={rows} />
        {result.predecessorNumber && (
          <div className="mt-4 px-4 py-3 rounded-md bg-accent-2-100 border border-accent-2-300 text-[12.5px] text-accent-2-800">
            Re-issued credential. This certificate replaces {result.predecessorNumber}, which is retired and no longer valid.
          </div>
        )}
        <div className="text-neutral-500 text-[11.5px] mt-4">This record is issued directly by Lavelle Institute and reflects the register as of today.</div>
      </Card>
    );
  }

  if (result.result === "revoked") {
    return (
      <Card elev="lg" className="p-6 mt-6 border-l-[3px] border-l-[#b42318]">
        <div className="flex items-center gap-2.5">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdecec] text-[#b42318] flex items-center justify-center text-sm font-bold">!</span>
          <div className="font-heading font-bold text-[17px] text-[#b42318]">Revoked credential</div>
        </div>
        <p className="text-neutral-700 text-[13.5px] mt-3">
          This certificate was revoked{result.revokedAt ? ` on ${fmtDate(result.revokedAt)}` : ""} following {result.revokedReason ?? "a registrar decision"}.
          It may not be relied upon as evidence of a Lavelle credential.
        </p>
        <div className="border-t border-dashed border-neutral-300 my-4" />
        <RecordRows rows={rows} />
        {result.successorNumber && (
          <div className="mt-4 px-4 py-3 rounded-md bg-accent-100 border border-accent-200 text-[12.5px] text-accent-800">
            A replacement credential was subsequently issued to this holder as {result.successorNumber}. Verify that identifier for the current record.
          </div>
        )}
        <div className="text-neutral-500 text-[11.5px] mt-4">
          Register as of today. Queries about a revocation should be directed to <a href="mailto:registrar@lavelle.ng">registrar@lavelle.ng</a>.
        </div>
      </Card>
    );
  }

  // superseded
  return (
    <Card elev="lg" className="p-6 mt-6 border-l-[3px] border-l-neutral-400">
      <div className="flex items-center gap-2.5">
        <span className="w-[26px] h-[26px] flex-none rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-bold">i</span>
        <div className="font-heading font-bold text-[17px] text-neutral-700">Superseded credential</div>
      </div>
      <p className="text-neutral-700 text-[13.5px] mt-3">
        This certificate was not invalid — it was replaced. It is no longer the current credential on record.
      </p>
      <div className="border-t border-dashed border-neutral-300 my-4" />
      <RecordRows rows={rows} />
      {result.successorNumber && (
        <div className="mt-4 px-4 py-3 rounded-md bg-accent-100 border border-accent-200 text-[12.5px] text-accent-800">
          The current certificate is {result.successorNumber}. Verify that identifier for the record now in force.
        </div>
      )}
    </Card>
  );
}

function RecordRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 pb-3 border-b border-dashed border-neutral-300 last:border-b-0 last:pb-0">
          <span className="text-neutral-500 text-[12.5px]">{row.label}</span>
          <span className="text-[13.5px] text-right">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
