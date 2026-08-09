import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { tierLabel } from "@/lib/format";
import type { getCandidateCertificatesForAdmin } from "@/lib/candidate-admin-reads";

type Certificates = Awaited<ReturnType<typeof getCandidateCertificatesForAdmin>>;

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  REVOKED: "danger",
  SUPERSEDED: "outline",
};

export function CandidateCertificatesTab({ certificates }: { certificates: Certificates }) {
  if (certificates.length === 0) {
    return (
      <div className="text-center py-12 px-6 border border-divider rounded-md">
        <div className="font-heading font-semibold text-[15px]">No certificates issued yet</div>
      </div>
    );
  }

  return (
    <div className="border border-divider rounded-md overflow-hidden">
      <Table>
        <Thead>
          <Tr>
            <Th className="pl-[var(--space-4)]">Certificate number</Th>
            <Th>Programme</Th>
            <Th>Tier</Th>
            <Th>Issued</Th>
            <Th>Status</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          {certificates.map((c) => (
            <Tr key={c.id}>
              <Td className="pl-[var(--space-4)] tabular-nums text-[13px]">{c.certificateNumber}</Td>
              <Td className="font-medium">{c.programme.title}</Td>
              <Td>{tierLabel(c.tier)}</Td>
              <Td>{new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Td>
              <Td>
                <Tag variant={STATUS_TAG[c.status] as TagVariant}>{c.status}</Tag>
              </Td>
              <Td className="text-right pr-[var(--space-4)]">
                <Link href="/admin/certificates" className="text-accent text-xs">
                  View register
                </Link>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
