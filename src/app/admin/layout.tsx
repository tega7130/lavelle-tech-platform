import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-session";
import { ROLE_LABELS } from "@/lib/permissions";
import { listStaffNotifications } from "@/lib/staff-notifications";
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

  const notifications = await listStaffNotifications(staff.id);

  return (
    <>
      <SessionExpiryBanner expiresAt={staff.sessionExpiresAt} signInPath="/staff/sign-in" />
      <AdminShell
        staff={{ name: staff.name, initials, role: ROLE_LABELS[staff.role] }}
        headerTag="September 2026 intake"
        initialNotifications={notifications}
      >
        {children}
      </AdminShell>
    </>
  );
}
