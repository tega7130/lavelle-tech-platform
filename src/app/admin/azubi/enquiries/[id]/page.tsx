import { notFound } from "next/navigation";
import { getAzubiEnquiry, listAzubiAssignableStaff } from "@/lib/azubi-reads";
import { updateAzubiEnquiryStatusAction, assignAzubiEnquiryAction, updateAzubiEnquiryNotesAction, anonymizeAzubiEnquiryAction } from "@/app/actions/azubi-admin";
import { Textarea } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";

const STATUS_OPTIONS = ["NEW", "REPLIED", "CLOSED"];

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiEnquiryDetailPage({ params }: PageProps<"/admin/azubi/enquiries/[id]">) {
  const { id } = await params;
  const [enquiry, staffList] = await Promise.all([getAzubiEnquiry(id), listAzubiAssignableStaff()]);
  if (!enquiry) notFound();

  return (
    <div className="max-w-[900px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation &rsaquo; Enquiries</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-[var(--space-4)]">{enquiry.fullName}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-[var(--space-5)]">
        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Submitted details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-3)] text-[13px]">
            <Row label="Email" value={enquiry.email} />
            <Row label="Organisation" value={enquiry.organisation ?? "—"} />
            <Row label="Writing as" value={enquiry.writingAs.replace("_", " ")} />
            <Row label="Source" value={enquiry.source === "HOME_FORM" ? "Home page form" : "Contact page"} />
            <Row label="Submitted" value={enquiry.createdAt.toLocaleString()} />
          </dl>
          <div className="mt-[var(--space-4)]">
            <div className="text-[11px] tracking-[0.06em] uppercase text-neutral-500 mb-1">Message</div>
            <p className="text-[13px] text-text whitespace-pre-wrap">{enquiry.message}</p>
          </div>
        </section>

        <aside className="flex flex-col gap-[var(--space-4)]">
          <form action={updateAzubiEnquiryStatusAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={enquiry.id} />
            <label htmlFor="status" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Status
            </label>
            <select id="status" name="status" defaultValue={enquiry.status} className={selectClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Update status
            </button>
          </form>

          <form action={assignAzubiEnquiryAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={enquiry.id} />
            <label htmlFor="assignedToStaffId" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Assigned to
            </label>
            <select id="assignedToStaffId" name="assignedToStaffId" defaultValue={enquiry.assignedToStaffId ?? ""} className={selectClass}>
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

          <form action={updateAzubiEnquiryNotesAction} className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
            <input type="hidden" name="id" value={enquiry.id} />
            <label htmlFor="internalNotes" className="text-[11px] tracking-[0.06em] uppercase text-neutral-500">
              Internal notes
            </label>
            <Textarea id="internalNotes" name="internalNotes" defaultValue={enquiry.internalNotes ?? ""} rows={4} />
            <button type="submit" className={buttonClassName("secondary", "mt-1")}>
              Save notes
            </button>
          </form>

          <form action={anonymizeAzubiEnquiryAction} className="border border-divider rounded-md p-[var(--space-3)]">
            <input type="hidden" name="id" value={enquiry.id} />
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
