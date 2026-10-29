import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { listLawyerWebsiteVerificationQueue, listLawyerWebsiteVerificationHistory } from "@/lib/lawyer-website-reads";
import { LawyerWebsiteModeration } from "@/components/admin/lawyer-website-moderation";

export default async function Page() {
  await requireStaffPermission(Permission.MANAGE_LAWYER_WEBSITES);

  const [pending, approved, rejected] = await Promise.all([
    listLawyerWebsiteVerificationQueue(),
    listLawyerWebsiteVerificationHistory("APPROVED"),
    listLawyerWebsiteVerificationHistory("REJECTED"),
  ]);

  return <LawyerWebsiteModeration initial={{ pending, approved, rejected }} />;
}
