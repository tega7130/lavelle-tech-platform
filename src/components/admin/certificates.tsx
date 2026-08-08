"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Input, Textarea, Label } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { tierLabel } from "@/lib/format";
import {
  listCertificatesAction,
  listCertificateTemplatesAction,
  issueCertificateManuallyAction,
  revokeCertificateAction,
  reissueCertificateAction,
  createTemplateRevisionAction,
  activateTemplateAction,
  getCertificateDownloadUrlAction,
  type ManualIssueFormInput,
} from "@/app/actions/certificates";
import { finaliseUpload } from "@/app/actions/uploads";
import type { listCertificates, listCertificateTemplates } from "@/lib/certificate-reads";

type Certificates = Awaited<ReturnType<typeof listCertificates>>;
type Templates = Awaited<ReturnType<typeof listCertificateTemplates>>;
type Certificate = Certificates[number];

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };
const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "accent-2",
  REVOKED: "danger",
  SUPERSEDED: "neutral",
};
const TIER_OPTIONS = ["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"] as const;
const BAND_OPTIONS = ["DISTINCTION", "MERIT", "PASS", "REFER"] as const;

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function uploadArtwork(file: File) {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "image", mimeType: file.type, bytes: file.size, purpose: "certificate" }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseUpload({ storageKey, kind: "image", mimeType: file.type, originalFilename: file.name, purpose: "certificate" });
}

export function AdminCertificates({ certificates: initialCertificates, templates: initialTemplates }: { certificates: Certificates; templates: Templates }) {
  const router = useRouter();
  const [certificates, setCertificates] = React.useState(initialCertificates);
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  const [revokeTarget, setRevokeTarget] = React.useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = React.useState("");
  const [reissueTarget, setReissueTarget] = React.useState<Certificate | null>(null);
  const [reissueReason, setReissueReason] = React.useState("");
  const [showIssueForm, setShowIssueForm] = React.useState(false);

  async function refresh() {
    const [c, t] = await Promise.all([listCertificatesAction(), listCertificateTemplatesAction()]);
    setCertificates(c);
    setTemplates(t);
  }

  const filtered = certificates.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.certificateNumber.toLowerCase().includes(q) || c.holderName.toLowerCase().includes(q) || (c.candidateNumber ?? "").toLowerCase().includes(q);
  });

  async function confirmRevoke() {
    if (!revokeTarget || !revokeReason.trim()) return;
    setBusy(true);
    try {
      await revokeCertificateAction(revokeTarget.id, revokeReason);
      setRevokeTarget(null);
      setRevokeReason("");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmReissue() {
    if (!reissueTarget || !reissueReason.trim()) return;
    setBusy(true);
    try {
      await reissueCertificateAction(reissueTarget.id, reissueReason);
      setReissueTarget(null);
      setReissueReason("");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    const url = await getCertificateDownloadUrlAction(id);
    window.open(url, "_blank");
  }

  return (
    <div className="max-w-[1300px] flex flex-col gap-[var(--space-6)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-heading text-2xl m-0">Certificates</h1>
        <Button onClick={() => setShowIssueForm((v) => !v)}>{showIssueForm ? "Close" : "Issue manually"}</Button>
      </div>

      {showIssueForm && <ManualIssueForm onIssued={async () => { setShowIssueForm(false); await refresh(); router.refresh(); }} />}

      <Card elev="sm">
        <div className="flex gap-3 flex-wrap items-center">
          <Input placeholder="Search number, holder, candidate number" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[280px]" />
          <select
            className="h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Revoked</option>
            <option value="SUPERSEDED">Superseded</option>
          </select>
        </div>

        {certificates.length === 0 ? (
          <div className="text-center py-12">
            <div className="font-heading font-semibold text-[14px]">No certificates issued</div>
            <p className="text-neutral-600 text-[12.5px] mt-1.5">Certificates are issued on a passed certifying examination.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="font-heading font-semibold text-[14px]">No certificates match those filters</div>
            <p className="text-neutral-600 text-[12.5px] mt-1.5">Clear the search or status filter to see the full register.</p>
          </div>
        ) : (
          <Table className="mt-4">
            <Thead>
              <Tr>
                <Th>Number</Th>
                <Th>Holder</Th>
                <Th>Programme</Th>
                <Th>Tier</Th>
                <Th>Band</Th>
                <Th>Status</Th>
                <Th>Issued</Th>
                <Th>Checked</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium tabular-nums text-[12.5px]">{c.certificateNumber}</Td>
                  <Td>
                    <div className="text-[13px]">{c.holderName}</div>
                    <div className="text-neutral-500 text-[11px]">{c.candidateNumber}</div>
                  </Td>
                  <Td className="text-[12.5px]">{c.programmeTitle}</Td>
                  <Td className="text-[12.5px]">{tierLabel(c.tier)}</Td>
                  <Td className="text-[12.5px]">{BAND_LABEL[c.band]}</Td>
                  <Td>
                    <Tag variant={STATUS_TAG[c.status]}>{c.status === "ACTIVE" ? "Active" : c.status === "REVOKED" ? "Revoked" : "Superseded"}</Tag>
                    {c.supersededByNumber && <div className="text-neutral-500 text-[10.5px] mt-1">→ {c.supersededByNumber}</div>}
                    {c.replacesNumber && <div className="text-neutral-500 text-[10.5px] mt-1">replaces {c.replacesNumber}</div>}
                  </Td>
                  <Td className="text-[12px] tabular-nums">{fmtDate(c.issuedAt)}</Td>
                  <Td className="text-[12px] tabular-nums">{c.verificationCount}</Td>
                  <Td>
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => download(c.id)}>
                        PDF
                      </Button>
                      {c.status === "ACTIVE" && (
                        <Button variant="secondary" className="h-[30px] px-[10px] text-xs border-[#e8b4ae] text-[#b42318]" onClick={() => setRevokeTarget(c)}>
                          Revoke
                        </Button>
                      )}
                      {c.status !== "SUPERSEDED" && (
                        <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => setReissueTarget(c)}>
                          Re-issue
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <TemplateDesigner templates={templates} onChanged={refresh} />

      {revokeTarget && (
        <Dialog open onClose={() => setRevokeTarget(null)} title="Revoke this certificate?">
          <p>
            {revokeTarget.certificateNumber} — {revokeTarget.holderName}
          </p>
          <p className="mt-2">
            The credential is withdrawn and the download blocked. Programme access, results and the practice record are unaffected — this is not a
            suspension.
          </p>
          <div className="mt-4">
            <Label>Reason (mandatory, written to the audit log and shown to the candidate)</Label>
            <Textarea rows={3} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Assessment integrity finding of the examinations panel" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !revokeReason.trim()} onClick={confirmRevoke}>
              Revoke certificate
            </Button>
          </div>
        </Dialog>
      )}

      {reissueTarget && (
        <Dialog open onClose={() => setReissueTarget(null)} title="Re-issue this certificate?">
          <p>
            {reissueTarget.certificateNumber} — {reissueTarget.holderName}
          </p>
          <p className="mt-2">
            Creates a new certificate with a new number.{" "}
            {reissueTarget.status === "REVOKED"
              ? "This one stays on the record as revoked — the chain will read revoked, then replaced."
              : "This one becomes superseded, not revoked — it was never invalid."}
          </p>
          <div className="mt-4">
            <Label>Reason (mandatory, written to the audit log and shown to the candidate)</Label>
            <Textarea rows={3} value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} placeholder="Appeal upheld by the examinations panel" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setReissueTarget(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !reissueReason.trim()} onClick={confirmReissue}>
              Re-issue certificate
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ManualIssueForm({ onIssued }: { onIssued: () => void }) {
  const [form, setForm] = React.useState<ManualIssueFormInput>({
    candidateEmail: "",
    programmeCode: "",
    finalPercent: 60,
    band: "PASS",
    reason: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await issueCertificateManuallyAction(form);
      onIssued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not issue this certificate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card elev="sm" className="border-accent-300">
      <CardKicker>Manual issue — edge cases only</CardKicker>
      <p className="text-neutral-500 text-[11.5px] -mt-1">A paper sitting, an appeal upheld — the automatic path on release covers everything else.</p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <Label>Candidate email</Label>
          <Input value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} placeholder="c.okonji@chambers.ng" />
        </div>
        <div>
          <Label>Programme code</Label>
          <Input value={form.programmeCode} onChange={(e) => setForm({ ...form, programmeCode: e.target.value })} placeholder="ELR-201" />
        </div>
        <div>
          <Label>Final mark (%)</Label>
          <Input
            type="number"
            value={form.finalPercent}
            onChange={(e) => setForm({ ...form, finalPercent: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Band</Label>
          <select
            className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={form.band}
            onChange={(e) => setForm({ ...form, band: e.target.value as ManualIssueFormInput["band"] })}
          >
            {BAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {BAND_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <Label>Reason (mandatory)</Label>
        <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Paper sitting recorded outside the exam system" />
      </div>
      {error && <div className="text-[#b42318] text-[12.5px] mt-2">{error}</div>}
      <Button className="mt-4 self-start" disabled={busy || !form.candidateEmail || !form.programmeCode || !form.reason.trim()} onClick={submit}>
        {busy ? "Issuing…" : "Issue certificate"}
      </Button>
    </Card>
  );
}

function TemplateDesigner({ templates, onChanged }: { templates: Templates; onChanged: () => Promise<void> }) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [tierScope, setTierScope] = React.useState<string>("");
  const [signatoryBlock, setSignatoryBlock] = React.useState("Registrar · Dean of Faculty");
  const [printedFields, setPrintedFields] = React.useState({
    name: true,
    programmeAndTier: true,
    band: true,
    certificateIdAndQr: true,
    pathwayMark: true,
    issueDate: true,
  });
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const asset = await uploadArtwork(file);
      await createTemplateRevisionAction({
        name,
        artworkAssetId: asset.id,
        appliesToTier: (tierScope || null) as never,
        signatoryBlock,
        printedFields,
      });
      setShowForm(false);
      setName("");
      setFile(null);
      await onChanged();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this revision.");
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    await activateTemplateAction(id);
    await onChanged();
    router.refresh();
  }

  return (
    <Card elev="sm">
      <div className="flex items-center justify-between">
        <CardKicker>Template designer</CardKicker>
        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New revision"}
        </Button>
      </div>

      {showForm && (
        <div className="mt-3 p-4 rounded-md border border-dashed border-neutral-300 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lavelle certificate — 2027 revision" />
            </div>
            <div>
              <Label>Tier scope</Label>
              <select className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg" value={tierScope} onChange={(e) => setTierScope(e.target.value)}>
                <option value="">All tiers</option>
                {TIER_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {tierLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Signatory block</Label>
            <Input value={signatoryBlock} onChange={(e) => setSignatoryBlock(e.target.value)} />
          </div>
          <div>
            <Label>Artwork (landscape A4, 300dpi)</Label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[12.5px]" />
          </div>
          <div>
            <div className="text-neutral-500 text-[10.5px] tracking-[0.1em] uppercase mb-2">Printed fields</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(printedFields) as (keyof typeof printedFields)[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printedFields[key]}
                    onChange={(e) => setPrintedFields({ ...printedFields, [key]: e.target.checked })}
                    className="w-4 h-4 accent-accent"
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>
          {error && <div className="text-[#b42318] text-[12.5px]">{error}</div>}
          <Button className="self-start" disabled={busy || !name || !file} onClick={submit}>
            {busy ? "Saving…" : "Save revision"}
          </Button>
        </div>
      )}

      <Table className="mt-4">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Tier scope</Th>
            <Th>Issued with</Th>
            <Th>Status</Th>
            <Th></Th>
          </Tr>
        </Thead>
        <Tbody>
          {templates.map((t) => (
            <Tr key={t.id}>
              <Td className="text-[13px]">{t.name}</Td>
              <Td className="text-[12.5px]">{t.appliesToTier ? tierLabel(t.appliesToTier) : "All tiers"}</Td>
              <Td className="text-[12.5px] tabular-nums">{t.issuedCount}</Td>
              <Td>
                <Tag variant={t.isActive ? "accent-2" : "neutral"}>{t.isActive ? "Active" : "Retired"}</Tag>
              </Td>
              <Td>
                {!t.isActive && (
                  <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => activate(t.id)}>
                    Activate
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Card>
  );
}
