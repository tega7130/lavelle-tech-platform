import { renderMarkupToReact } from "@/lib/rich-text";

export interface BlogPostViewProps {
  title: string;
  tags: string[];
  authorName: string;
  dateLabel: string;
  heroImageUrl: string | null;
  body: string;
}

/**
 * The article body — shared between the public /blog/[slug] page and the
 * admin editor's Preview dialog, so a preview is exactly what goes live,
 * not a lookalike that can drift from the real markup/classes.
 */
export function BlogPostView({ title, tags, authorName, dateLabel, heroImageUrl, body }: BlogPostViewProps) {
  return (
    <>
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-5">
          {tags.map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em] bg-accent-100 text-accent-700">
              {t}
            </span>
          ))}
        </div>
      )}

      <h1 className="font-heading font-semibold text-[34px] leading-[1.16] mt-4 tracking-[-0.02em]">{title || "Untitled post"}</h1>
      <div className="text-[13px] text-neutral-500 mt-3">
        {authorName || "—"} · {dateLabel}
      </div>

      {heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={heroImageUrl} alt="" className="w-full aspect-[16/9] object-cover rounded-xl mt-7" />
      )}

      <div className="mt-9 text-[15.5px] leading-[1.75] text-neutral-800 [&_p]:mt-0 [&_p]:mb-5 [&_ul]:mb-5 [&_ol]:mb-5 [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_strong]:font-semibold">
        {body.trim() ? renderMarkupToReact(body) : <span className="text-neutral-400 italic">Nothing written yet.</span>}
      </div>
    </>
  );
}
