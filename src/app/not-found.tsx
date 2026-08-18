import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";

/** Copy verbatim from Lavelle States.dc.html's "Not found" full-page state. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-[var(--space-6)]">
      <div className="text-center max-w-[420px]">
        <div className="flex items-center justify-center gap-2.5">
          <LogoMark size={30} />
          <span className="font-heading font-bold text-sm tracking-[0.02em]">LAVELLE INSTITUTE</span>
        </div>

        <div className="w-[52px] h-[52px] mx-auto mt-[var(--space-6)] rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-neutral-500 text-xl">
          ?
        </div>

        <div className="font-heading font-semibold text-[21px] mt-[var(--space-4)]">That page does not exist</div>
        <p className="text-[13px] text-neutral-600 leading-relaxed mt-2.5">
          The link may be out of date, or the programme it pointed to has been archived. Nothing has gone wrong with
          your account.
        </p>

        <div className="flex gap-3 justify-center mt-[var(--space-6)] flex-wrap">
          <Link href="/portal/dashboard" className={buttonClassName("primary")}>
            Go to your dashboard
          </Link>
          <Link href="/portal/catalogue" className={buttonClassName("secondary")}>
            Browse programmes
          </Link>
        </div>
      </div>
    </div>
  );
}
