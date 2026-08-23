import Link from "next/link";
import { getPublishedBlogPosts } from "@/lib/blog-reads";
import { Card, CardTitle, CardBody, CardMeta } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function PortalBlogPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <div className="max-w-[1180px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Blog</h1>

      {posts.length === 0 ? (
        <Card elev="sm" className="items-center text-center py-12 px-6">
          <div className="font-heading font-semibold text-[15px]">Nothing published yet</div>
          <p className="text-neutral-600 text-[12.5px] max-w-[44ch] mx-auto mt-2">Check back soon.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-[var(--space-4)]">
          {posts.map((p) => (
            <Link key={p.slug} href={`/portal/blog/${p.slug}`} className="no-underline text-text">
              <Card elev="sm" className="overflow-hidden h-full">
                {p.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.heroImageUrl} alt="" className="w-full aspect-[16/9] object-cover rounded-md" />
                ) : null}
                {p.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {p.tags.slice(0, 2).map((t) => (
                      <Tag key={t} variant="accent">{t}</Tag>
                    ))}
                  </div>
                )}
                <CardTitle className="mt-1.5">{p.title}</CardTitle>
                <CardBody>{p.excerpt}</CardBody>
                <CardMeta>
                  {p.authorName} · {formatDate(p.publishedAt)}
                </CardMeta>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
