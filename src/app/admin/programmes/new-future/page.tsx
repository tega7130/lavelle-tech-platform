import { listCategories, listProgrammeAuthors } from "@/lib/programme-reads";
import { createFutureProgramme } from "@/app/actions/programme";
import { ProgrammeDetailsForm } from "@/components/admin/programme-details-form";

export default async function NewFutureProgrammePage() {
  const [categories, authors] = await Promise.all([listCategories(), listProgrammeAuthors()]);

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">Coming Soon</div>
      <h2 className="mb-1">Create future programme</h2>
      <p className="mb-4 max-w-[70ch] text-[13px] text-neutral-600 leading-relaxed">
        Announce a programme before its course content exists. It publishes immediately as Coming Soon — visitors see the
        title, tier, and fee with a &ldquo;Notify me&rdquo; form instead of a price and enrol button. Build the syllabus
        whenever it&rsquo;s ready, then switch it to open for enrolment from the Website page.
      </p>
      <ProgrammeDetailsForm mode="create" futureMode categories={categories} authors={authors} action={createFutureProgramme} />
    </div>
  );
}
