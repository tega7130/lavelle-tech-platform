import { notFound } from "next/navigation";
import {
  getAzubiApplication,
  listAzubiAssignableStaff,
  listAzubiOrganizationOptions,
  listAzubiSupervisorOptions,
  getAzubiActivityLog,
  getAzubiOrganizationMatches,
} from "@/lib/azubi-reads";
import {
  updateAzubiApplicationStatusAction,
  assignAzubiApplicationAction,
  updateAzubiApplicationNotesAction,
  setAzubiApplicationStatusConfirmedAction,
  anonymizeAzubiApplicationAction,
  assignAzubiApplicationOrganizationAction,
  assignAzubiApplicationSupervisorAction,
  setAzubiApplicationSuspendedAction,
} from "@/app/actions/azubi-admin";
import { Textarea } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";
import { AzubiActivityTimeline } from "@/components/admin/azubi/azubi-activity-timeline";

const PIPELINE_OPTIONS = ["NEW", "UNDER_REVIEW", "SHORTLISTED", "STATUS_CONFIRMED", "MATCHED", "PLACED", "DECLINED", "WITHDRAWN"];

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span
        className={`w-[16px] h-[16px] rounded-full flex items-center justify-center text-[10px] flex-none ${
          done ? "bg-accent text-white" : "bg-neutral-200 text-neutral-500"
        }`}
      >
        {done ? "✓" : "—"}
      </span>
      <span className={done ? "text-text" : "text-neutral-600"}>{label}</span>
    </li>
  );
}

export default async function AzubiApplicationDetailPage({ params }: PageProps<"/admin/azubi/applications/[id]">) {
  const { id } = await params;
  const [application, staffList, organizations, supervisors, activity, matches] = await Promise.all([
    getAzubiApplication(id),
    listAzubiAssignableStaff(),
    listAzubiOrganizationOptions(),
    listAzubiSupervisorOptions(),
    getAzubiActivityLog("AzubiApplication", id),
    getAzubiOrganizationMatches(id),
  ]);
  if (!application) notFound();

  return (
    <div className="max-w-[1000px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation &rsaquo; Fellows</div>
      <div className="flex items-center gap-2 flex-wrap mt-0.5 mb-[var(--space-4)]">
        <h1 className="font-heading text-2xl">{application.fullName}</h1>
        {application.suspended && (
          <span className="inline-flex items-center rounded-full bg-[#fdecec] text-[#b42318] px-2 py-0.5 text-[11px] font-medium">Suspended</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-[var(--space-5)]">
        <div className="flex flex-col gap-[var(--space-5)]">
          <section className="border border-divider rounded-md p-[var(--space-4)]">
            <h2 className="font-heading text-base mb-[var(--space-3)]">Submitted details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-3)] text-[13px]">
              <Row label="Email" value={application.email} />
              <Row label="Phone" value={application.phone} />
              <Row label="Country" value={application.country} />
              <Row label="State of residence" value={application.state} />
              <Row label="Current status" value={application.statusKind.replace("_", " ")} />
              <Row label="University / law school" value={application.institution} />
              <Row label="Working mode" value={application.workingMode} />
              <Row label="Areas of interest" value={application.areas.join(", ") || "—"} />
              {application.otherAreaDetail && <Row label="Other area (detail)" value={application.otherAreaDetail} />}
              <Row label="Submitted" value={application.createdAt.toLocaleString()} />
            </dl>
            <div className="mt-[var(--space-4)]">
              <div className="text-[11px] tracking-[0.06em] uppercase text-neutral-500 mb-1">Why they want to join</div>
              <p className="text-[13px] text-text whitespace-pre-wrap">{application.statement}</p>
            </div>

            <div className="mt-[var(--space-5)] pt-[var(--space-4)] border-t border-dashed border-neutral-300">
              <form action={setAzubiApplicationStatusConfirmedAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={application.id} />
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="status-confirmed"
                    name="confirmed"
                    defaultChecked={!!application.statusConfirmedAt}
                    className="w-[18px] h-[18px] accent-accent"
                  />
                  <label htmlFor="status-confirmed" className="text-[13px] text-text">
                    Status confirmed (student ID, law school ID or call certificate checked)
                    {application.statusConfirmedAt && (
                      <span className="text-neutral-500"> — {application.statusConfirmedAt.toLocaleDateString()}</span>
                    )}
                  </label>
                </span>
                <button type="submit" className={buttonClassName("secondary")}>
                  Save
                </button>
              </form>
            </div>
          </section>

          {!application.assignedOrganizationId && matches.length > 0 && (
            <section className="border border-divider rounded-md p-[var(--space-4)]">
              <h2 className="font-heading text-base mb-[var(--space-3)]">Suggested organizations</h2>
              <ul className="flex flex-col gap-[var(--space-2)]">
                {matches.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-divider px-[var(--space-3)] py-[var(--space-2)]"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-text">{m.name}</div>
                      <div className="text-[11.5px] text-neutral-600">
                        {m.reasons.length > 0 ? m.reasons.join(" · ") : "No stated preferences"}
                        {m.capacity != null && (
                          <>
                            {" "}
                            · {m.assigned}/{m.capacity} fellows
                          </>
                        )}
                      </div>
                    </div>
                    <form action={assignAzubiApplicationOrganizationAction}>
                      <input type="hidden" name="id" value={application.id} />
                      <input type="hidden" name="organizationId" value={m.id} />
                      <button type="submit" className={buttonClassName("secondary")}>
                        Assign
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-[var(--space-4)]">
          <div className="border border-divider rounded-md p-[var(--space-3)]">
            <h2 className="font-heading text-sm mb-[var(--space-2)]">What&rsquo;s left</h2>
            <ul className="flex flex-col gap-[var(--space-2)]">
              <ChecklistRow label="Status confirmed" done={!!application.statusConfirmedAt} />
              <ChecklistRow label="Assigned to an organization" done={!!application.assignedOrganizationId} />
              <ChecklistRow label="Assigned a supervisor" done={!!application.assignedSupervisorId} />
              <ChecklistRow label="Placed" done={application.pipelineStatus === "PLACED"} />
            </ul>
          </div>

          <form action={updateAzubiApplicationStatusAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="pipelineStatus" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Pipeline status
            </label>
            <select id="pipelineStatus" name="pipelineStatus" defaultValue={application.pipelineStatus} className={selectClass}>
              {PIPELINE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace("_", " ")}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Update status
            </button>
          </form>

          <form action={assignAzubiApplicationOrganizationAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="organizationId" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Host organization
            </label>
            <select id="organizationId" name="organizationId" defaultValue={application.assignedOrganizationId ?? ""} className={selectClass}>
              <option value="">Unassigned</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Assign organization
            </button>
          </form>

          <form action={assignAzubiApplicationSupervisorAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="supervisorId" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Azubi supervisor
            </label>
            <select id="supervisorId" name="supervisorId" defaultValue={application.assignedSupervisorId ?? ""} className={selectClass}>
              <option value="">Unassigned</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Assign supervisor
            </button>
          </form>

          <form action={assignAzubiApplicationAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="assignedToStaffId" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Case handled by
            </label>
            <select id="assignedToStaffId" name="assignedToStaffId" defaultValue={application.assignedToStaffId ?? ""} className={selectClass}>
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Assign
            </button>
          </form>

          <form action={setAzubiApplicationSuspendedAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <input type="hidden" name="suspended" value={application.suspended ? "false" : "true"} />
            <button type="submit" className={buttonClassName(application.suspended ? "secondary" : "danger")}>
              {application.suspended ? "Unsuspend" : "Suspend"}
            </button>
          </form>

          <form action={updateAzubiApplicationNotesAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="internalNotes" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Internal notes
            </label>
            <Textarea id="internalNotes" name="internalNotes" defaultValue={application.internalNotes ?? ""} rows={4} />
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Save notes
            </button>
          </form>

          <div className="border border-divider rounded-md p-[var(--space-3)]">
            <h2 className="font-heading text-sm mb-[var(--space-2)]">Activity</h2>
            <AzubiActivityTimeline events={activity} />
          </div>

          <form action={anonymizeAzubiApplicationAction} className="border border-divider rounded-md p-[var(--space-3)]">
            <input type="hidden" name="id" value={application.id} />
            <p className="text-[12px] text-neutral-600 mb-2">Data-subject request: permanently redact personal details on this row.</p>
            <button type="submit" className={buttonClassName("danger")}>
              Anonymise record
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">{label}</dt>
      <dd className="text-text mt-0.5">{value}</dd>
    </div>
  );
}
