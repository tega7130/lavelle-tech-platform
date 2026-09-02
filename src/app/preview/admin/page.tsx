import { AdminShell } from "@/components/shell/admin-shell";
import { ScreenPlaceholder } from "@/components/shell/placeholder";

/**
 * Auth/DB-free render of the admin shell for local design-fidelity
 * review. Not linked from the app; not covered by the auth middleware.
 */
export default function PreviewAdminPage() {
  return (
    <AdminShell staff={{ name: "Adaeze Obi", initials: "AO", role: "Registrar" }}>
      <ScreenPlaceholder title="Overview" />
    </AdminShell>
  );
}
