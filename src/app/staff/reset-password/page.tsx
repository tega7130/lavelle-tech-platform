import { previewInvitationToken } from "@/lib/staff-invitation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function StaffResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const preview = token ? await previewInvitationToken(token) : null;
  return <ResetPasswordForm token={token ?? ""} preview={preview} />;
}
