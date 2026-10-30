import { notFound } from "next/navigation";
import { getAzubiApplication, listAzubiAssignableStaff } from "@/lib/azubi-reads";
import {
  updateAzubiApplicationStatusAction,
  assignAzubiApplicationAction,
  updateAzubiApplicationNotesAction,
  setAzubiApplicationStatusConfirmedAction,
  anonymizeAzubiApplicationAction,
} from "@/app/actions/azubi-admin";
import { Textarea } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";

const PIPELINE_OPTIONS = ["NEW", "UNDER_REVIEW", "SHORTLISTED", "STATUS_CONFIRMED", "MATCHED", "PLACED", "DECLINED", "WITHDRAWN"];

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiApplicationDetailPage({ params }: PageProps<"/admin/azubi/applications/[id]">) {
  const { id } = await params;
  const [application, staffList] = await Promise.all([getAzubiApplication(id), listAzubiAssignableStaff()]);
  if (!application) notFound();

  return (
    <div className="max-w-[900px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation &rsaquo; Applications</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-[var(--space-4)]">{application.fullName}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-[var(--space-5)]">
        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Submitted details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-3)] text-[13px]">
            <Row label="Email" value={application.email} />
            <Row label="Phone" value={application.phone} />
            <Row label="State of residence" value={application.state} />
            <Row label="Current status" value={application.statusKind.replace("_", " ")} />
            <Row label="University / law school" value={application.institution} />
            <Row label="Working mode" value={application.workingMode} />
            <Row label="Areas of interest" value={application.areas.join(", ") || "—"} />
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

        <aside className="flex flex-col gap-[var(--space-4)]">
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

          <form action={assignAzubiApplicationAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={application.id} />
            <label htmlFor="assignedToStaffId" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Assigned to
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
