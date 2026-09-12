import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-session";
import { ROLE_LABELS } from "@/lib/permissions";
import { listStaffNotifications } from "@/lib/staff-notifications";
import { countPendingMarks } from "@/lib/marking-reads";
import { countOpenSupportRequests } from "@/lib/support-reads";
import { AdminShell } from "@/components/shell/admin-shell";
import { SessionExpiryBanner } from "@/components/shell/session-expiry-banner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/staff/sign-in");

  const initials = staff.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [notifications, markingCount, supportCount] = await Promise.all([
    listStaffNotifications(staff.id),
    countPendingMarks(),
    countOpenSupportRequests(),
  ]);

  const badges: Record<string, string> = {};
  if (markingCount > 0) badges.marking = String(markingCount);
  if (supportCount > 0) badges.support = String(supportCount);

  return (
    <>
      <SessionExpiryBanner expiresAt={staff.sessionExpiresAt.toISOString()} signInPath="/staff/sign-in" />
      <AdminShell
        staff={{ name: staff.name, initials, role: ROLE_LABELS[staff.role] }}
        badges={badges}
        initialNotifications={notifications}
      >
        {children}
      </AdminShell>
    </>
  );
}
