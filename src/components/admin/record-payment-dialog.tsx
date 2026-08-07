"use client";

import * as React from "react";
import { useActionState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { confirmPaymentManually, recordOfflinePayment } from "@/app/actions/payment";
import { finaliseUpload } from "@/app/actions/uploads";
import { emptyActionState } from "@/lib/action-state";

const MODES = [
  { value: "BANK_TRANSFER", label: "Bank transfer", meta: "Direct transfer into the Lavelle account", refLabel: "Bank transaction reference", refHint: "GTB/TRF/20260806/884213" },
  { value: "CASH_DEPOSIT", label: "Cash deposit at branch", meta: "Teller deposit — attach the stamped slip", refLabel: "Teller slip number", refHint: "004512" },
  { value: "POS_TERMINAL", label: "POS terminal", meta: "Card taken at the Lavelle office", refLabel: "Terminal reference", refHint: "POS-2026-0806-33" },
  { value: "CHEQUE", label: "Cheque", meta: "Only once cleared by the bank", refLabel: "Cheque number", refHint: "004512" },
] as const;

async function uploadReceipt(file: File) {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "document", mimeType: file.type, bytes: file.size, purpose: "finance" }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseUpload({ storageKey, kind: "document", mimeType: file.type, originalFilename: file.name, purpose: "finance" });
}

export interface RecordPaymentDialogProps {
  onClose: () => void;
  onRecorded?: () => void;
  /** An existing PENDING payment — ledger row or candidate Payments-tab "Manually confirm". */
  existing?: { paymentId: string; candidateName: string; programmeName: string; expectedLabel: string };
  /** No payment row exists yet — candidate record, "transferred before ever starting checkout". */
  fresh?: { candidateId: string; programmeId: string; candidateName: string; programmeName: string };
}

/**
 * The single offline-recording form, reused by every entry point (ledger
 * pending row, candidate record Payments tab "Manually confirm", and
 * candidate record "Record payment" for someone with no payment row at
 * all) — all six required inputs, every time, never a shortened version.
 */
export function RecordPaymentDialog({ onClose, onRecorded, existing, fresh }: RecordPaymentDialogProps) {
  const boundAction = existing ? confirmPaymentManually.bind(null, existing.paymentId) : recordOfflinePayment;
  const [state, formAction, pending] = useActionState(boundAction, emptyActionState);
  const [mode, setMode] = React.useState<(typeof MODES)[number]["value"]>("BANK_TRANSFER");
  const [receiptAssetId, setReceiptAssetId] = React.useState<string | null>(null);
  const [receiptName, setReceiptName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const modeMeta = MODES.find((m) => m.value === mode)!;

  const recorded = state.ok === true;
  React.useEffect(() => {
    if (recorded) onRecorded?.();
  }, [recorded, onRecorded]);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const asset = await uploadReceipt(file);
      setReceiptAssetId(asset.id);
      setReceiptName(file.name);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not upload that file.");
    } finally {
      setUploading(false);
    }
  }

  const subject = existing
    ? `${existing.candidateName} · ${existing.programmeName} · expected ${existing.expectedLabel}`
    : fresh
      ? `${fresh.candidateName} · ${fresh.programmeName}`
      : "";

  if (recorded) {
    return (
      <Dialog open onClose={onClose} title="Payment recorded" className="w-[min(460px,100%)]">
        <p className="text-[13px] text-neutral-700">
          The payment has been recorded, written to the audit log, and the candidate notified.
        </p>
        <div className="flex justify-end mt-2">
          <Button type="button" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title="Record an offline payment" className="w-[min(560px,100%)] max-h-[calc(100vh-64px)] overflow-y-auto">
      <div className="text-[12.5px] text-neutral-600 -mt-2 mb-3">{subject}</div>
      <form action={formAction} className="flex flex-col gap-[var(--space-3)]">
        {fresh && (
          <>
            <input type="hidden" name="candidateId" value={fresh.candidateId} />
            <input type="hidden" name="programmeId" value={fresh.programmeId} />
          </>
        )}
        <input type="hidden" name="receiptAssetId" value={receiptAssetId ?? ""} />

        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <Field>
            <Label>Amount received (₦)</Label>
            <Input name="amountNaira" defaultValue={state.values?.amountNaira} invalid={!!state.errors?.amountNaira} />
            <FieldError>{state.errors?.amountNaira}</FieldError>
          </Field>
          <Field>
            <Label>Date received</Label>
            <Input type="date" name="offlineReceivedOn" defaultValue={state.values?.offlineReceivedOn} invalid={!!state.errors?.offlineReceivedOn} />
            <FieldError>{state.errors?.offlineReceivedOn}</FieldError>
          </Field>
        </div>

        <Field>
          <Label>Mode of payment</Label>
          <div className="flex flex-col gap-[7px]">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-md cursor-pointer border ${mode === m.value ? "border-accent bg-accent-100" : "border-neutral-300"}`}
              >
                <input
                  type="radio"
                  name="offlineMode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="mt-[3px]"
                />
                <div>
                  <div className="text-[13px] font-medium">{m.label}</div>
                  <div className="text-[11px] text-neutral-500">{m.meta}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>

        <Field>
          <Label>{modeMeta.refLabel}</Label>
          <Input name="offlineReference" placeholder={modeMeta.refHint} defaultValue={state.values?.offlineReference} invalid={!!state.errors?.offlineReference} />
          <FieldError>{state.errors?.offlineReference}</FieldError>
          {mode === "CHEQUE" && (
            <div className="text-[11.5px] text-neutral-500 mt-1.5">
              Record only after the cheque has cleared — a returned cheque cannot unwind an enrolment.
            </div>
          )}
        </Field>

        <Field>
          <Label>Transaction receipt</Label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-[13px]"
          />
          {uploading && <div className="text-[11.5px] text-neutral-500 mt-1.5">Uploading…</div>}
          {receiptName && !uploading && <div className="text-[11.5px] text-neutral-600 mt-1.5">{receiptName} attached</div>}
          {uploadError && <FieldError>{uploadError}</FieldError>}
          <FieldError>{state.errors?.receiptAssetId}</FieldError>
          <div className="text-[11.5px] text-neutral-500 mt-1.5">PDF, JPG or PNG. Held on the candidate record.</div>
        </Field>

        <Field>
          <Label>Reconciliation note</Label>
          <Textarea
            name="reconciliationNote"
            rows={2}
            placeholder="Matched against the 6 August GTBank statement, line 42."
            defaultValue={state.values?.reconciliationNote}
            invalid={!!state.errors?.reconciliationNote}
          />
          <FieldError>{state.errors?.reconciliationNote}</FieldError>
        </Field>

        <div className="flex items-start gap-2.5 p-3.5 rounded-md bg-[#fff7e6] border border-[#f0d9a8]">
          <span className="flex-none w-6 h-6 rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-[13px] font-bold">!</span>
          <div className="text-xs text-[#8a6013] leading-relaxed">
            Recording this payment issues a candidate number, activates the enrolment, assigns a cohort place and
            issues an ID card. It is written to the immutable audit log against your name and cannot be undone.
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-neutral-700">
          <input type="checkbox" name="verified" className="mt-[3px]" />
          <span>I have verified this payment against the bank statement</span>
        </label>
        <FieldError>{state.errors?.verified}</FieldError>

        {state.message && <div className="text-[12.5px] text-[#b42318]">{state.message}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending || uploading}>
            Record payment and enrol
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
