import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/staff-session";
import { ROLE_LABELS } from "@/lib/permissions";
import { AdminShell } from "@/components/shell/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/staff/sign-in");

  const initials = staff.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AdminShell
      staff={{ name: staff.name, initials, role: ROLE_LABELS[staff.role] }}
      headerTag="September 2026 intake"
    >
      {children}
    </AdminShell>
  );
}
