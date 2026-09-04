import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { getSignedAssetUrl } from "@/lib/storage";

/** Admin: every post, newest first — the source for the Blog list screen. */
export async function listBlogPosts() {
  await requireStaffPermission(Permission.MANAGE_BLOG);
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdByStaff: { select: { name: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    authorName: p.authorName,
    createdByName: p.createdByStaff.name,
    isPublished: p.isPublished,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  }));
}

/** The editor's data for one post — includes a signed hero preview URL up front so opening the editor doesn't need a round trip just to show it. */
export async function getBlogPostForEditor(id: string) {
  await requireStaffPermission(Permission.MANAGE_BLOG);
  const post = await prisma.blogPost.findUniqueOrThrow({
    where: { id },
    include: { heroAsset: { select: { id: true, originalFilename: true, storageKey: true } } },
  });
  return {
    ...post,
    heroImageUrl: post.heroAsset ? getSignedAssetUrl(post.heroAsset.storageKey, "image") : null,
  };
}
