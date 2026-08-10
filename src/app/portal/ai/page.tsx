import { requireEnrolledPage } from "@/lib/candidate-session";
import { AiIcon } from "@/components/icons";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  await requireEnrolledPage();

  return (
    <div className="max-w-[560px] mx-auto text-center py-16">
      <div className="w-11 h-11 mx-auto rounded-[11px] bg-accent-100 border border-accent-200 flex items-center justify-center text-accent-700">
        <AiIcon width={20} height={20} />
      </div>
      <span className="inline-flex items-center rounded-full text-[10px] font-semibold tracking-[0.08em] uppercase px-[10px] py-[3px] bg-accent-100 text-accent-700 mt-4">
        Coming soon
      </span>
      <h2 className="mt-3 mb-0">Lavelle AI</h2>
      <p className="text-neutral-600 text-[13.5px] leading-relaxed mt-2.5">
        Lavelle AI will answer questions on the material in your enrolled programmes and cite the lecture it draws
        from — it won&rsquo;t answer on matters outside them. We&rsquo;re still building it; check back soon.
      </p>
    </div>
  );
}
