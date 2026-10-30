import { notFound } from "next/navigation";
import Link from "next/link";
import { getAzubiSupervisor, getAzubiActivityLog, listAzubiAssignableStaff } from "@/lib/azubi-reads";
import { updateAzubiSupervisorAction, deleteAzubiSupervisorAction, assignAzubiApplicationSupervisorAction } from "@/app/actions/azubi-admin";
import { Field, Label, Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { AzubiActivityTimeline } from "@/components/admin/azubi/azubi-activity-timeline";

const selectClass =
  "h-11 font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiSupervisorDetailPage({ params }: PageProps<"/admin/azubi/supervisors/[id]">) {
  const { id } = await params;
  const [supervisor, activity, staffOptions] = await Promise.all([
    getAzubiSupervisor(id),
    getAzubiActivityLog("AzubiSupervisor", id),
    listAzubiAssignableStaff(),
  ]);
  if (!supervisor) notFound();

  return (
    <div className="max-w-[1000px]">
      <Link href="/admin/azubi/supervisors" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; Supervisors
      </Link>
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">{supervisor.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-5)]">
          <section className="border border-divider rounded-md p-[var(--space-4)]">
            <h2 className="font-heading text-base mb-[var(--space-3)]">Supervisor details</h2>
            <form action={updateAzubiSupervisorAction} className="flex flex-col gap-[var(--space-3)]">
              <input type="hidden" name="id" value={supervisor.id} />
              <Field>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" type="text" defaultValue={supervisor.name} required dense />
              </Field>
              <Field>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={supervisor.email} required dense />
              </Field>
              <Field>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={supervisor.phone ?? ""} dense />
              </Field>
              <Field>
                <Label htmlFor="staffId">Linked Lavelle staff account</Label>
                <select id="staffId" name="staffId" defaultValue={supervisor.staffId ?? ""} className={selectClass}>
                  <option value="">External — not Lavelle staff</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <button type="submit" className={buttonClassName("secondary")}>
                  Save changes
                </button>
              </div>
            </form>
          </section>

          <section className="border border-divider rounded-md p-[var(--space-4)]">
            <h2 className="font-heading text-base mb-[var(--space-3)]">Fellows supervised ({supervisor.fellows.length})</h2>
            {supervisor.fellows.length === 0 ? (
              <p className="text-[13px] text-neutral-600">No fellows assigned to this supervisor yet.</p>
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Fellow</Th>
                    <Th>Organization</Th>
                    <Th>Pipeline</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {supervisor.fellows.map((f) => (
                    <Tr key={f.id}>
                      <Td>
                        <Link href={`/admin/azubi/applications/${f.id}`} className="text-text no-underline hover:underline">
                          {f.fullName}
                        </Link>
                      </Td>
                      <Td className="text-[12.5px]">{f.assignedOrganization?.name ?? "—"}</Td>
                      <Td className="text-[12.5px]">{f.pipelineStatus.replace("_", " ")}</Td>
                      <Td>
                        <form action={assignAzubiApplicationSupervisorAction}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="supervisorId" value="" />
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
          <div className="border border-divider rounded-md p-[var(--space-3)]">
            <h2 className="font-heading text-sm mb-[var(--space-2)]">Activity</h2>
            <AzubiActivityTimeline events={activity} />
          </div>

          <form action={deleteAzubiSupervisorAction} className="border border-divider rounded-md p-[var(--space-3)]">
            <input type="hidden" name="id" value={supervisor.id} />
            <p className="text-[12px] text-neutral-600 mb-2">Only possible once no fellows are assigned here.</p>
            <button type="submit" className={buttonClassName("danger")}>
              Delete supervisor
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
