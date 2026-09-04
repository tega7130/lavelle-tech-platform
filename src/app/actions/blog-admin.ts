"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import { getSignedAssetUrl } from "@/lib/storage";
import {
  createBlogPost as createBlogPostLib,
  updateBlogPost as updateBlogPostLib,
  publishBlogPost as publishBlogPostLib,
  unpublishBlogPost as unpublishBlogPostLib,
  deleteBlogPost as deleteBlogPostLib,
  type BlogPostInput,
} from "@/lib/blog-admin-actions";

function revalidateAll(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/portal/blog");
  revalidatePath("/admin/blog");
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`/portal/blog/${slug}`);
  }
}

export async function createBlogPostAction(input: BlogPostInput) {
  const staff = await requireStaffPermission(Permission.MANAGE_BLOG);
  const post = await createBlogPostLib(input, staff.id);
  revalidateAll(post.slug);
  revalidatePath(`/admin/blog/${post.id}`);
  return post;
}

export async function updateBlogPostAction(id: string, input: BlogPostInput) {
  await requireStaffPermission(Permission.MANAGE_BLOG);
  const post = await updateBlogPostLib(id, input);
  revalidateAll(post.slug);
  revalidatePath(`/admin/blog/${post.id}`);
  return post;
}

export async function publishBlogPostAction(id: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_BLOG);
  await publishBlogPostLib(id, staff.id);
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  revalidateAll(post.slug);
  revalidatePath(`/admin/blog/${id}`);
}

export async function unpublishBlogPostAction(id: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_BLOG);
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  await unpublishBlogPostLib(id, trimmed, staff.id);
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  revalidateAll(post.slug);
  revalidatePath(`/admin/blog/${id}`);
}

/** A fresh signed URL for a hero image, so the editor's Preview dialog can show it before the post is ever saved or published. */
export async function getBlogHeroPreviewUrlAction(storageKey: string) {
  await requireStaffPermission(Permission.MANAGE_BLOG);
  return getSignedAssetUrl(storageKey, "image");
}

export async function deleteBlogPostAction(id: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_BLOG);
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  await deleteBlogPostLib(id, staff.id);
  revalidateAll(post.slug);
}
