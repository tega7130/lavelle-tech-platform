"use client";

import * as React from "react";
import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { BetaSignupDetailModal } from "./beta-signup-detail-modal";
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

export function BetaFeatureSectionClient({ signups }: { signups: BetaSignup[] }) {
  const [selectedSignup, setSelectedSignup] = React.useState<BetaSignup | null>(null);

  return (
    <>
      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Candidate</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th>Signed up</Th>
              <Th className="pr-[var(--space-4)] text-right">Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {signups.map((s) => (
              <Tr key={s.id}>
                <Td className="pl-[var(--space-4)] font-medium">
                  <Link href={`/admin/candidates/${s.candidateId}`} className="text-accent no-underline">
                    {s.candidate.firstName} {s.candidate.lastName}
                  </Link>
                  <div className="text-[11px] text-neutral-500">{s.candidate.email}</div>
                </Td>
                <Td>
                  <Tag variant={STATUS_TAG[s.status] as TagVariant}>{s.status}</Tag>
                </Td>
                <Td className="text-[12px] text-neutral-600">{s.source ?? "—"}</Td>
                <Td className="text-[12px] text-neutral-600">{s.createdAt.toLocaleDateString()}</Td>
                <Td className="pr-[var(--space-4)] text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-[32px] text-[12px]"
                    onClick={() => setSelectedSignup(s)}
                  >
                    View
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <BetaSignupDetailModal signup={selectedSignup} open={!!selectedSignup} onClose={() => setSelectedSignup(null)} />
    </>
  );
}
