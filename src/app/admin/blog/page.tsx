import Link from "next/link";
import { listBlogPosts } from "@/lib/blog-admin-reads";
import { buttonClassName } from "@/components/ui/button";
import { BlogList } from "@/components/admin/blog-list";

export default async function AdminBlogPage() {
  const posts = await listBlogPosts();

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[var(--space-5)]">
        <div>
          <div className="text-[10px] tracking-[0.1em] uppercase font-semibold text-accent">Public site</div>
          <div className="font-heading font-semibold text-[17px] mt-[2px]">Blog</div>
          <div className="text-neutral-600 text-[12.5px] leading-[1.6] mt-1 max-w-[70ch]">
            Write and publish articles shown on the public website and inside the candidate portal.
          </div>
        </div>
        <Link href="/admin/blog/new" className={buttonClassName("primary", "h-[38px] text-[13px]")}>
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No posts yet</div>
          <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[44ch] mx-auto">
            Create your first post — it stays a draft until you publish it.
          </p>
        </div>
      ) : (
        <div className="border border-divider rounded-md p-[var(--space-3)]">
          <BlogList posts={posts} />
        </div>
      )}
    </div>
  );
}
