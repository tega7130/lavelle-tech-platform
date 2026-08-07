import { notFound } from "next/navigation";
import { getProgrammeContent } from "@/lib/programme-reads";
import { ProgrammeContentEditor } from "@/components/admin/programme-content-editor";

export default async function ProgrammeContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const programme = await getProgrammeContent(id);
  if (!programme) notFound();

  return <ProgrammeContentEditor programme={programme} />;
}
