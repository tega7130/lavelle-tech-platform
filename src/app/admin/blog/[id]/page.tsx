import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostForEditor } from "@/lib/blog-admin-reads";
import { BlogEditor } from "@/components/admin/blog-editor";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getBlogPostForEditor(id).catch(() => null);
  if (!post) notFound();

  return (
    <div className="max-w-[1000px]">
      <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; All posts
      </Link>
      <BlogEditor post={post} defaultAuthorName={post.authorName} />
    </div>
  );
}
