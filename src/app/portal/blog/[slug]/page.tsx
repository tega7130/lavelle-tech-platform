import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBlogPost } from "@/lib/blog-reads";
import { renderMarkupToReact } from "@/lib/rich-text";
import { Tag } from "@/components/ui/tag";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PortalBlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="max-w-[760px]">
      <Link href="/portal/blog" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; Blog
      </Link>

      {post.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {post.tags.map((t) => (
            <Tag key={t} variant="accent">{t}</Tag>
          ))}
        </div>
      )}

      <h1 className="font-heading font-semibold text-[28px] leading-[1.2] mt-3 tracking-[-0.015em]">{post.title}</h1>
      <div className="text-[13px] text-neutral-500 mt-2">
        {post.authorName} · {formatDate(post.publishedAt)}
      </div>

      {post.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.heroImageUrl} alt="" className="w-full aspect-[16/9] object-cover rounded-xl mt-6" />
      )}

      <div className="mt-7 text-[14.5px] leading-[1.75] text-neutral-800 [&_p]:mt-0 [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mb-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_strong]:font-semibold">
        {renderMarkupToReact(post.body)}
      </div>
    </div>
  );
}
