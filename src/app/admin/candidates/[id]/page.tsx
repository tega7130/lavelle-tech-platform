import { redirect } from "next/navigation";

export default async function CandidateRecordRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/candidates/${id}/overview`);
}
