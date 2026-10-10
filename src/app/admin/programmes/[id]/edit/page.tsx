import { notFound } from "next/navigation";
import { getProgrammeForEdit, listCategories, listProgrammeAuthors } from "@/lib/programme-reads";
import { listPracticeAreas } from "@/app/actions/practice-area";
import { updateProgramme } from "@/app/actions/programme";
import { ProgrammeDetailsForm } from "@/components/admin/programme-details-form";

export default async function EditProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [programme, categories, practiceAreas, authors] = await Promise.all([
    getProgrammeForEdit(id),
    listCategories(),
    listPracticeAreas(),
    listProgrammeAuthors(),
  ]);
  if (!programme) notFound();

  const boundUpdate = updateProgramme.bind(null, id);

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">
        Step 1 of 2 — Programme details
      </div>
      <h2 className="mb-4">Edit programme — {programme.title}</h2>
      <ProgrammeDetailsForm
        mode="edit"
        programmeId={id}
        categories={categories}
        practiceAreas={practiceAreas}
        authors={authors}
        initialValues={{
          title: programme.title,
          code: programme.code,
          practiceAreaId: programme.practiceAreaId,
          categoryId: programme.categoryId,
          tier: programme.tier,
          summary: programme.summary,
          authorName: programme.authorName,
          weeks: programme.weeks,
          weeklyHoursLabel: programme.weeklyHoursLabel,
          feeNaira: programme.feeMinor / 100,
          deliveryLabel: programme.deliveryLabel,
          prerequisiteTier: programme.prerequisiteTier,
          coverVideoUrl: programme.coverVideoUrl,
          coverVideoAsset: programme.coverVideoAsset,
        }}
        action={boundUpdate}
      />
    </div>
  );
}
