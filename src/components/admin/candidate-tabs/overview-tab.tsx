"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Label } from "@/components/ui/field";
import { updateCandidateDetailsAction } from "@/app/actions/candidate-admin";

export function CandidateOverviewTab({
  candidateId,
  applicantNumber,
  candidateNumber,
  email,
  phoneCountryCode,
  firstName,
  lastName,
  phone,
  canEdit,
  enrolmentCount,
  paymentCount,
  certificateCount,
  openRequestCount,
}: {
  candidateId: string;
  applicantNumber: string;
  candidateNumber: string | null;
  email: string;
  phoneCountryCode: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  canEdit: boolean;
  enrolmentCount: number;
  paymentCount: number;
  certificateCount: number;
  openRequestCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({ firstName, lastName, phone: phone ?? "" });
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    try {
      await updateCandidateDetailsAction(candidateId, form);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Card elev="sm">
        <div className="flex items-center justify-between mb-2">
          <CardKicker>Identity</CardKicker>
          {canEdit && !editing && (
            <Button variant="secondary" className="h-[28px] px-[10px] text-[11px]" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>First name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Field>
              <Field>
                <Label>Last name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Field>
            </div>
            <Field>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={submit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2 text-[13px]">
            <div>
              <div className="text-neutral-500 text-xs">Applicant number</div>
              <div className="tabular-nums">{applicantNumber}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Candidate number</div>
              <div className="tabular-nums">{candidateNumber ?? "Not yet issued"}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Email</div>
              <div>{email}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Phone</div>
              <div>
                {phoneCountryCode} {phone ?? "—"}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <SummaryTile label="Enrolments" count={enrolmentCount} href={`/admin/candidates/${candidateId}/enrolments`} />
        <SummaryTile label="Payments" count={paymentCount} href={`/admin/candidates/${candidateId}/payments`} />
        <SummaryTile label="Certificates" count={certificateCount} href={`/admin/candidates/${candidateId}/certificates`} />
        <SummaryTile label="Open requests" count={openRequestCount} href={`/admin/candidates/${candidateId}/notes`} />
      </div>
    </div>
  );
}

function SummaryTile({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link href={href} className="block no-underline text-text">
      <Card elev="sm" className="hover:border-accent-300">
        <CardKicker>{label}</CardKicker>
        <div className="font-heading font-bold text-2xl mt-1">{count}</div>
      </Card>
    </Link>
  );
}
