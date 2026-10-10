import { listCategories, listProgrammeAuthors } from "@/lib/programme-reads";
import { listPracticeAreas } from "@/app/actions/practice-area";
import { createProgramme } from "@/app/actions/programme";
import { ProgrammeDetailsForm } from "@/components/admin/programme-details-form";

export default async function NewProgrammePage() {
  const [categories, practiceAreas, authors] = await Promise.all([listCategories(), listPracticeAreas(), listProgrammeAuthors()]);

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
        Step 1 of 2 — Programme details
      </div>
      <h2 className="mb-4">New programme</h2>
      <ProgrammeDetailsForm
        mode="create"
        categories={categories}
        practiceAreas={practiceAreas}
        authors={authors}
        action={createProgramme}
      />
    </div>
  );
}
