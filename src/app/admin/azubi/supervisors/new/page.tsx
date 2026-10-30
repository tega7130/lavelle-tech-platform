import Link from "next/link";
import { listAzubiAssignableStaff } from "@/lib/azubi-reads";
import { createAzubiSupervisorAction } from "@/app/actions/azubi-admin";
import { Field, Label, Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";

const selectClass =
  "h-11 font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function NewAzubiSupervisorPage() {
  const staffOptions = await listAzubiAssignableStaff();

  return (
    <div className="max-w-[560px]">
      <Link href="/admin/azubi/supervisors" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; Supervisors
      </Link>
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Add supervisor</h1>

      <form action={createAzubiSupervisorAction} className="flex flex-col gap-[var(--space-3)]">
        <Field>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" type="text" required dense />
        </Field>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required dense />
        </Field>
        <Field>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" dense />
        </Field>
        <Field>
          <Label htmlFor="staffId">Link to a Lavelle staff account (optional)</Label>
          <select id="staffId" name="staffId" defaultValue="" className={selectClass}>
            <option value="">External — not Lavelle staff</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <button type="submit" className={buttonClassName("primary")}>
            Add supervisor
          </button>
        </div>
      </form>
    </div>
  );
}
