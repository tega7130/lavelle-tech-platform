import { notFound } from "next/navigation";
import Link from "next/link";
import { getAzubiOrganization, getAzubiActivityLog, listAzubiUnassignedFellowOptions } from "@/lib/azubi-reads";
import {
  updateAzubiOrganizationAction,
  updateAzubiOrganizationNotesAction,
  deleteAzubiOrganizationAction,
  assignAzubiApplicationOrganizationAction,
} from "@/app/actions/azubi-admin";
import { Field, Label, Input, Textarea } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { AzubiActivityTimeline } from "@/components/admin/azubi/azubi-activity-timeline";
import { AzubiBarList } from "@/components/admin/azubi/azubi-charts";
import { AZUBI_AREA_LABELS, AZUBI_PIPELINE_LABELS, AZUBI_STATUS_KIND_LABELS, AZUBI_WORKING_MODE_LABELS } from "@/lib/azubi/labels";

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiOrganizationDetailPage({ params }: PageProps<"/admin/azubi/organizations/[id]">) {
  const { id } = await params;
  const [organization, activity, unassignedFellows] = await Promise.all([
    getAzubiOrganization(id),
    getAzubiActivityLog("AzubiOrganization", id),
    listAzubiUnassignedFellowOptions(),
  ]);
  if (!organization) notFound();

  const areaCounts: Record<string, number> = {};
  const statusKindCounts: Record<string, number> = {};
  const workingModeCounts: Record<string, number> = {};
  let verifiedCount = 0;
  for (const f of organization.fellows) {
    for (const area of f.areas) areaCounts[area] = (areaCounts[area] ?? 0) + 1;
    statusKindCounts[f.statusKind] = (statusKindCounts[f.statusKind] ?? 0) + 1;
    workingModeCounts[f.workingMode] = (workingModeCounts[f.workingMode] ?? 0) + 1;
    if (f.statusConfirmedAt) verifiedCount += 1;
  }
  const areaItems = Object.entries(areaCounts)
    .map(([key, value]) => ({ label: AZUBI_AREA_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
  const statusKindItems = Object.entries(AZUBI_STATUS_KIND_LABELS).map(([key, label]) => ({ label, value: statusKindCounts[key] ?? 0 }));
  const workingModeItems = Object.entries(AZUBI_WORKING_MODE_LABELS).map(([key, label]) => ({ label, value: workingModeCounts[key] ?? 0 }));

  return (
    <div className="max-w-[1000px]">
      <Link href="/admin/azubi/organizations" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; Organizations
      </Link>
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">{organization.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-5)]">
          <section className="border border-divider rounded-md p-[var(--space-4)]">
            <h2 className="font-heading text-base mb-[var(--space-3)]">Organization details</h2>
            <form action={updateAzubiOrganizationAction} className="flex flex-col gap-[var(--space-3)]">
              <input type="hidden" name="id" value={organization.id} />
              <Field>
                <Label htmlFor="name">Organization name</Label>
                <Input id="name" name="name" type="text" defaultValue={organization.name} required dense />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)]">
                <Field>
                  <Label htmlFor="supervisorName">Org supervisor name</Label>
                  <Input id="supervisorName" name="supervisorName" type="text" defaultValue={organization.supervisorName ?? ""} dense />
                </Field>
                <Field>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input id="capacity" name="capacity" type="number" min={0} defaultValue={organization.capacity ?? ""} dense />
                </Field>
                <Field>
                  <Label htmlFor="supervisorEmail">Org supervisor email</Label>
                  <Input id="supervisorEmail" name="supervisorEmail" type="email" defaultValue={organization.supervisorEmail ?? ""} dense />
                </Field>
                <Field>
                  <Label htmlFor="supervisorPhone">Org supervisor phone</Label>
                  <Input id="supervisorPhone" name="supervisorPhone" type="tel" defaultValue={organization.supervisorPhone ?? ""} dense />
                </Field>
              </div>
              <Field>
                <Label htmlFor="preferredPracticeAreas">Preferred practice areas</Label>
                <Textarea
                  id="preferredPracticeAreas"
                  name="preferredPracticeAreas"
                  defaultValue={organization.preferredPracticeAreas ?? ""}
                  rows={2}
                  placeholder="E.g. Corporate law, M&A, commercial disputes"
                />
              </Field>
              <Field>
                <Label htmlFor="preferredFellowLevel">Preferred fellow level</Label>
                <Input
                  id="preferredFellowLevel"
                  name="preferredFellowLevel"
                  type="text"
                  defaultValue={organization.preferredFellowLevel ?? ""}
                  placeholder="E.g. Called to the Bar, or any"
                  dense
                />
              </Field>
              <Field>
                <Label htmlFor="desiredFellowTraits">Desired fellow traits</Label>
                <Textarea
                  id="desiredFellowTraits"
                  name="desiredFellowTraits"
                  defaultValue={organization.desiredFellowTraits ?? ""}
                  rows={2}
                  placeholder="E.g. Strong writing skills, interest in tech law"
                />
              </Field>
              <div>
                <button type="submit" className={buttonClassName("secondary")}>
                  Save changes
                </button>
              </div>
            </form>
          </section>

          {organization.fellows.length > 0 && (
            <section className="border border-divider rounded-md p-[var(--space-4)]">
              <h2 className="font-heading text-base mb-[var(--space-3)]">Roster snapshot</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)]">
                <div>
                  <div className="text-[11px] tracking-[0.06em] uppercase text-neutral-500 mb-2">Area of interest</div>
                  <AzubiBarList items={areaItems} barColor="var(--color-azubi-apricot, #e8a159)" />
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.06em] uppercase text-neutral-500 mb-2">Status</div>
                  <AzubiBarList items={statusKindItems} />
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.06em] uppercase text-neutral-500 mb-2">Working mode</div>
                  <AzubiBarList items={workingModeItems} barColor="#0f766e" />
                </div>
              </div>
              <div className="mt-[var(--space-4)] pt-[var(--space-3)] border-t border-dashed border-neutral-300 text-[13px] text-text">
                <strong>{verifiedCount}</strong> of <strong>{organization.fellows.length}</strong> fellows have confirmed status
                (student/law school ID or call certificate checked).
              </div>
            </section>
          )}

          <section className="border border-divider rounded-md p-[var(--space-4)]">
            <h2 className="font-heading text-base mb-[var(--space-3)]">Roster ({organization.fellows.length})</h2>

            <form action={assignAzubiApplicationOrganizationAction} className="flex items-center gap-2 mb-[var(--space-4)]">
              <input type="hidden" name="organizationId" value={organization.id} />
              <select name="id" defaultValue="" required className={selectClass}>
                <option value="" disabled>
                  {unassignedFellows.length === 0 ? "No unassigned fellows" : "Choose a fellow to add…"}
                </option>
                {unassignedFellows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} — {f.email}
                  </option>
                ))}
              </select>
              <button type="submit" className={buttonClassName("secondary")} disabled={unassignedFellows.length === 0}>
                Add fellow
              </button>
            </form>

            {organization.fellows.length === 0 ? (
              <p className="text-[13px] text-neutral-600">No fellows assigned to this organization yet.</p>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Fellow</Th>
                    <Th>Interests</Th>
                    <Th>Status</Th>
                    <Th>Verified</Th>
                    <Th>Pipeline</Th>
                    <Th>Assigned</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {organization.fellows.map((f) => (
                    <Tr key={f.id}>
                      <Td>
                        <Link href={`/admin/azubi/applications/${f.id}`} className="text-text no-underline hover:underline">
                          {f.fullName}
                        </Link>
                      </Td>
                      <Td className="text-[12.5px]">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {f.areas.map((a) => (
                            <span key={a} className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-700 px-2 py-0.5 text-[10.5px]">
                              {AZUBI_AREA_LABELS[a] ?? a}
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td className="text-[12.5px]">{AZUBI_STATUS_KIND_LABELS[f.statusKind] ?? f.statusKind}</Td>
                      <Td className="text-[12.5px]">
                        {f.statusConfirmedAt ? (
                          <span className="inline-flex items-center rounded-full bg-accent-100 text-accent-700 px-2 py-0.5 text-[11px] font-medium">
                            Verified
                          </span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </Td>
                      <Td className="text-[12.5px]">{AZUBI_PIPELINE_LABELS[f.pipelineStatus] ?? f.pipelineStatus}</Td>
                      <Td className="text-[12.5px] text-neutral-600">{f.assignedAt ? f.assignedAt.toLocaleDateString() : "—"}</Td>
                      <Td>
                        <form action={assignAzubiApplicationOrganizationAction}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="organizationId" value="" />
                          <button type="submit" className={buttonClassName("ghost")}>
                            Remove
                          </button>
                        </form>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-[var(--space-4)]">
          <form action={updateAzubiOrganizationNotesAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={organization.id} />
            <label htmlFor="internalNotes" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Internal notes
            </label>
            <Textarea id="internalNotes" name="internalNotes" defaultValue={organization.internalNotes ?? ""} rows={4} />
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Save notes
            </button>
          </form>

          <div className="border border-divider rounded-md p-[var(--space-3)]">
            <h2 className="font-heading text-sm mb-[var(--space-2)]">Activity</h2>
            <AzubiActivityTimeline events={activity} />
          </div>

          <form action={deleteAzubiOrganizationAction} className="border border-divider rounded-md p-[var(--space-3)]">
            <input type="hidden" name="id" value={organization.id} />
            <p className="text-[12px] text-neutral-600 mb-2">Only possible once no fellows are assigned here.</p>
            <button type="submit" className={buttonClassName("danger")}>
              Delete organization
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
