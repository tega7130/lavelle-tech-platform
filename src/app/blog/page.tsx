import Link from "next/link";
import type { Metadata } from "next";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getPublishedBlogPosts } from "@/lib/blog-reads";

export const metadata: Metadata = {
  title: "Blog — Lavelle Institute",
  description: "Legal commentary, programme news and updates from the Lavelle Institute.",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-11 pb-[88px]">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6 md:px-8 lg:px-10">
          <div className="text-[11px] tracking-[0.18em] uppercase font-semibold text-accent">Blog</div>
          <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] lg:text-[38px] leading-[1.12] mt-4 max-w-[22ch] tracking-[-0.022em]">From the Lavelle Institute</h1>
          <p className="text-[15px] leading-[1.7] text-neutral-600 mt-[14px] max-w-[60ch]">
            Legal commentary, programme news and updates.
          </p>

          {posts.length === 0 ? (
            <div className="text-center py-16 mt-11 border border-divider rounded-[14px] bg-neutral-100">
              <div className="font-heading font-semibold text-[16px]">Nothing published yet</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-11">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="flex flex-col rounded-xl border border-divider bg-bg overflow-hidden no-underline text-text hover:shadow-[0_10px_28px_rgba(19,26,46,0.08)] transition-shadow"
                >
                  {p.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.heroImageUrl} alt="" className="w-full aspect-[16/9] object-cover" />
                  ) : (
                    <div className="w-full aspect-[16/9] bg-neutral-100" />
                  )}
                  <div className="p-5 flex flex-col gap-2">
                    {p.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {p.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em] bg-accent-100 text-accent-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="font-heading font-semibold text-[16px] leading-[1.3]">{p.title}</div>
                    <p className="text-[13px] leading-[1.6] text-neutral-600 line-clamp-2">{p.excerpt}</p>
                    <div className="text-[11.5px] text-neutral-500 mt-1">
                      {p.authorName} · {formatDate(p.publishedAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
