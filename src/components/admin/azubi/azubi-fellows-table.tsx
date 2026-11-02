"use client";

import * as React from "react";
import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button";
import {
  bulkAssignAzubiApplicationsOrganizationAction,
  bulkSetAzubiApplicationsSuspendedAction,
} from "@/app/actions/azubi-admin";

export interface AzubiFellowRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  statusKind: string;
  workingMode: string;
  pipelineStatus: string;
  suspended: boolean;
  assignedOrganization: { id: string; name: string } | null;
  assignedSupervisor: { id: string; name: string } | null;
  createdAt: Date;
}

const selectClass =
  "h-[34px] font-body text-[12.5px] text-text bg-bg border border-neutral-300 rounded-md px-2 outline-none hover:border-neutral-400 focus-visible:border-accent";

export function AzubiFellowsTable({ items, organizations }: { items: AzubiFellowRow[]; organizations: { id: string; name: string }[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOrgId, setBulkOrgId] = React.useState("");

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-md border border-accent-300 bg-accent-100 px-[var(--space-3)] py-[var(--space-2)]">
          <span className="text-[12.5px] font-medium text-accent-700">{selectedIds.length} selected</span>

          <form
            action={bulkAssignAzubiApplicationsOrganizationAction}
            className="flex items-center gap-2"
            onSubmit={() => setTimeout(() => setSelected(new Set()), 0)}
          >
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <select name="organizationId" value={bulkOrgId} onChange={(e) => setBulkOrgId(e.target.value)} className={selectClass}>
              <option value="">Unassign</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary")}>
              Assign organization
            </button>
          </form>

          <form action={bulkSetAzubiApplicationsSuspendedAction} onSubmit={() => setTimeout(() => setSelected(new Set()), 0)}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <input type="hidden" name="suspended" value="true" />
            <button type="submit" className={buttonClassName("danger")}>
              Suspend
            </button>
          </form>

          <form action={bulkSetAzubiApplicationsSuspendedAction} onSubmit={() => setTimeout(() => setSelected(new Set()), 0)}>
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <input type="hidden" name="suspended" value="false" />
            <button type="submit" className={buttonClassName("secondary")}>
              Unsuspend
            </button>
          </form>
        </div>
      )}

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)] w-[1%]">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-[15px] h-[15px] accent-accent" aria-label="Select all" />
              </Th>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Pipeline</Th>
              <Th>Organization</Th>
              <Th>Supervisor</Th>
              <Th>Pool status</Th>
              <Th>Submitted</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 && (
              <Tr>
                <Td colSpan={8} className="text-center text-neutral-600 py-[var(--space-5)]">
                  No fellows match these filters.
                </Td>
              </Tr>
            )}
            {items.map((a) => (
              <Tr key={a.id} aria-selected={selected.has(a.id)}>
                <Td className="pl-[var(--space-4)]">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleOne(a.id)}
                    className="w-[15px] h-[15px] accent-accent"
                    aria-label={`Select ${a.fullName}`}
                  />
                </Td>
                <Td>
                  <Link href={`/admin/azubi/applications/${a.id}`} className="text-text no-underline hover:underline">
                    {a.fullName}
                  </Link>
                  <div className="text-[11.5px] text-neutral-600">
                    {a.email} · {a.phone}
                  </div>
                </Td>
                <Td className="text-[12.5px]">{a.statusKind.replace("_", " ")}</Td>
                <Td className="text-[12.5px]">{a.pipelineStatus.replace("_", " ")}</Td>
                <Td className="text-[12.5px]">
                  {a.assignedOrganization ? (
                    <Link href={`/admin/azubi/organizations/${a.assignedOrganization.id}`} className="text-accent no-underline hover:underline">
                      {a.assignedOrganization.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">Unassigned</span>
                  )}
                </Td>
                <Td className="text-[12.5px]">
                  {a.assignedSupervisor ? (
                    <Link href={`/admin/azubi/supervisors/${a.assignedSupervisor.id}`} className="text-accent no-underline hover:underline">
                      {a.assignedSupervisor.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </Td>
                <Td className="text-[12.5px]">
                  {a.suspended ? (
                    <span className="inline-flex items-center rounded-full bg-[#fdecec] text-[#b42318] px-2 py-0.5 text-[11px] font-medium">Suspended</span>
                  ) : a.assignedOrganization ? (
                    <span className="inline-flex items-center rounded-full bg-accent-100 text-accent-700 px-2 py-0.5 text-[11px] font-medium">Assigned</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px] font-medium">Unassigned</span>
                  )}
                </Td>
                <Td className="text-[12.5px] text-neutral-600">{a.createdAt.toLocaleDateString()}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
