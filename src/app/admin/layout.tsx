import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { AdminShell } from "@/components/shell/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.userType !== "staff") redirect("/");

  const initials = session.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AdminShell
      staff={{ name: session.user.name, initials, role: ROLE_LABELS[session.user.role] }}
      headerTag="September 2026 intake"
    >
      {children}
    </AdminShell>
  );
}
