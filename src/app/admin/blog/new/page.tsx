import Link from "next/link";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { BlogEditor } from "@/components/admin/blog-editor";

export default async function NewBlogPostPage() {
  const staff = await requireStaffPermission(Permission.MANAGE_BLOG);

  return (
    <div className="max-w-[1000px]">
      <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-[var(--space-4)] no-underline">
        &larr; All posts
      </Link>
      <BlogEditor post={null} defaultAuthorName={staff.name} />
    </div>
  );
}
