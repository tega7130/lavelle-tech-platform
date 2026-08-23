import Link from "next/link";
import { cn } from "@/lib/cn";
import type { listBlogPosts } from "@/lib/blog-admin-reads";

type Post = Awaited<ReturnType<typeof listBlogPosts>>[number];

function formatDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogList({ posts }: { posts: Post[] }) {
  return (
    <div className="flex flex-col">
      {posts.map((p) => (
        <Link
          key={p.id}
          href={`/admin/blog/${p.id}`}
          className="flex-1 min-w-0 flex items-center gap-[11px] px-3 py-[11px] rounded-md hover:bg-neutral-100 no-underline text-text"
        >
          <span className={cn("w-2 h-2 flex-none rounded-full", p.isPublished ? "bg-[#15803d]" : "bg-neutral-400")} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium leading-[1.35] truncate">{p.title}</div>
            <div className="text-neutral-500 text-[11px] mt-[2px]">
              {p.authorName} · {p.isPublished ? `Published ${formatDate(p.publishedAt)}` : `Updated ${formatDate(p.updatedAt)}`}
            </div>
          </div>
          <span className={cn("tag flex-none text-[9.5px] font-semibold", p.isPublished ? "bg-[#e7f6ed] text-[#15803d]" : "bg-neutral-100 text-neutral-700")}>
            {p.isPublished ? "Live" : "Draft"}
          </span>
        </Link>
      ))}
    </div>
  );
}
