"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag, type TagVariant } from "@/components/ui/tag";
import type { BetaFeature } from "@/lib/beta-types";

interface BetaSignup {
  id: string;
  candidateId: string;
  feature: BetaFeature;
  status: "GRANTED" | "WAITLISTED";
  source: "AUTO" | "MANUAL" | null;
  createdAt: Date;
  candidate: { firstName: string; lastName: string; email: string };
  feedback: Array<{ id: string; kind: string; message: string }>;
}

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  GRANTED: "success",
  WAITLISTED: "warning",
};

export function BetaSignupDetailModal({
  signup,
  open,
  onClose,
}: {
  signup: BetaSignup | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!signup) return null;

  const { candidate, status, source, createdAt, feedback, candidateId } = signup;

  return (
    <Dialog open={open} onClose={onClose} title={`${candidate.firstName} ${candidate.lastName}`} className="w-[min(520px,100%)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 pb-2 border-b border-divider">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Email</div>
            <div className="text-[13px]">{candidate.email}</div>
          </div>
          <Link href={`/admin/candidates/${candidateId}`} className="text-[13px] text-accent no-underline hover:underline">
            View full profile →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Status</div>
            <div className="mt-1.5">
              <Tag variant={STATUS_TAG[status] as TagVariant}>{status}</Tag>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Source</div>
            <div className="text-[13px] mt-1.5">{source ?? "—"}</div>
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Signed up</div>
          <div className="text-[13px] mt-1.5">{createdAt.toLocaleString()}</div>
        </div>

        {feedback.length > 0 && (
          <div className="pt-2 border-t border-divider">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">Feedback</div>
            <div className="flex flex-col gap-3">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-md bg-neutral-50 p-3">
                  <div className="text-[10.5px] uppercase tracking-wide text-neutral-500 mb-1">{f.kind}</div>
                  <div className="text-[13px] text-neutral-700 whitespace-pre-wrap">{f.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
