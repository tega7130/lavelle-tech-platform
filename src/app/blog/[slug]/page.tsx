import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteCompactHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BlogPostView } from "@/components/site/blog-post-view";
import { getPublishedBlogPost, getPublishedBlogPosts } from "@/lib/blog-reads";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Statically pre-rendered for every published post (same rule as
// /programmes/[code]) — revalidatePath in publish/unpublishBlogPostAction
// keeps this current without a deploy.
export async function generateStaticParams() {
  const posts = await getPublishedBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Lavelle Institute Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="bg-bg">
      <SiteCompactHeader />

      <div className="py-11 pb-[88px]">
        <div className="mx-auto max-w-[760px] px-10">
          <Link href="/blog" className="text-[12.5px] text-neutral-600 font-medium no-underline hover:text-accent">
            &larr; Blog
          </Link>

          <BlogPostView
            title={post.title}
            tags={post.tags}
            authorName={post.authorName}
            dateLabel={formatDate(post.publishedAt)}
            heroImageUrl={post.heroImageUrl}
            body={post.body}
          />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
