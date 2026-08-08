import { VerifyPortal } from "@/components/verify/verify-portal";

// Deliberately outside /portal and /admin — this must render for a
// stranger with no account, no cookie and no context. No layout here
// requires a session; proxy.ts's matcher doesn't even cover this path.
export default async function Page({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  return <VerifyPortal initialNumber={number ?? ""} />;
}
