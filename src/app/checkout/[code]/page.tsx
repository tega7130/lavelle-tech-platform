import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgrammeDetail } from "@/lib/catalogue-reads";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { GuestCheckoutForm } from "@/components/checkout/guest-checkout-form";
import { formatNaira } from "@/lib/format";

/**
 * "Apply for this programme" lands here instead of /register — the
 * checkout-first flow: pay for a specific programme immediately, and the
 * account is created from these same details the moment payment confirms
 * (see confirmPayment's guest branch), rather than registering first and
 * finding the programme again from inside the portal.
 */
export default async function GuestCheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const programme = await getProgrammeDetail(code);
  if (!programme) notFound();

  return (
    <AuthSplitScreen
      kicker="Secure checkout"
      title={programme.title}
      body="Complete payment to apply — your candidate account is created automatically the moment payment is confirmed."
      formMaxWidth="520px"
      topRight={
        <>
          <span>Already have an account?</span>
          <Link href={`/sign-in?next=/portal/catalogue`} className="font-medium">
            Sign in
          </Link>
        </>
      }
      formChildren={<GuestCheckoutForm programmeId={programme.id} programmeTitle={programme.title} fee={formatNaira(programme.feeMinor)} />}
    >
      <div className="mt-9 border-t border-dashed border-white/22 pt-[26px]">
        <div className="text-[10px] tracking-[0.16em] text-white/50 uppercase">What happens next</div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-start gap-[11px]">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent-2/18 text-[9px] font-bold text-accent-2">1</span>
            <span className="text-[12.5px] leading-[1.55] text-white/68 text-pretty">Verify your email and pay securely</span>
          </div>
          <div className="flex items-start gap-[11px]">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent-2/18 text-[9px] font-bold text-accent-2">2</span>
            <span className="text-[12.5px] leading-[1.55] text-white/68 text-pretty">
              Your candidate account is created from these details
            </span>
          </div>
          <div className="flex items-start gap-[11px]">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent-2/18 text-[9px] font-bold text-accent-2">3</span>
            <span className="text-[12.5px] leading-[1.55] text-white/68 text-pretty">Sign in to your portal and begin</span>
          </div>
        </div>
      </div>
    </AuthSplitScreen>
  );
}
