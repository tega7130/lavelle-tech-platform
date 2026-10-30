import Link from "next/link";
import { createAzubiOrganizationAction } from "@/app/actions/azubi-admin";
import { Field, Label, Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";

export default function NewAzubiOrganizationPage() {
  return (
    <div className="max-w-[560px]">
      <Link href="/admin/azubi/organizations" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; Organizations
      </Link>
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Add organization</h1>

      <form action={createAzubiOrganizationAction} className="flex flex-col gap-[var(--space-3)]">
        <Field>
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" name="name" type="text" required dense />
        </Field>
        <Field>
          <Label htmlFor="supervisorName">Organization supervisor name</Label>
          <Input id="supervisorName" name="supervisorName" type="text" dense />
        </Field>
        <Field>
          <Label htmlFor="supervisorEmail">Organization supervisor email</Label>
          <Input id="supervisorEmail" name="supervisorEmail" type="email" dense />
        </Field>
        <Field>
          <Label htmlFor="supervisorPhone">Organization supervisor phone</Label>
          <Input id="supervisorPhone" name="supervisorPhone" type="tel" dense />
        </Field>
        <Field>
          <Label htmlFor="capacity">Capacity (optional)</Label>
          <Input id="capacity" name="capacity" type="number" min={0} dense />
        </Field>
        <div>
          <button type="submit" className={buttonClassName("primary")}>
            Add organization
          </button>
        </div>
      </form>
    </div>
  );
}
