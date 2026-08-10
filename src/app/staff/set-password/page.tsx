import { previewInvitationToken } from "@/lib/staff-invitation";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const preview = token ? await previewInvitationToken(token) : null;
  return <SetPasswordForm token={token ?? ""} preview={preview} />;
}
