import { notFound } from "next/navigation";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getLawyerWebsiteForAdminReview } from "@/lib/lawyer-website-reads";
import { LawyerSiteView } from "@/components/site/lawyer-site-view";

export default async function AdminLawyerWebsitePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPermission(Permission.MANAGE_LAWYER_WEBSITES);
  const { id } = await params;

  const site = await getLawyerWebsiteForAdminReview(id);
  if (!site) notFound();

  return <LawyerSiteView {...site} isPreview />;
}
