import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { p2002Target } from "@/lib/prisma-errors";
import { isMarkupEmpty } from "@/lib/rich-text";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as website-admin-actions.ts. staffId is always passed in by
// the caller (a "use server" Action that already checked the permission),
// which keeps this file importable from plain Vitest tests.

export interface BlogPostInput {
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  authorName: string;
  heroAssetId?: string | null;
}

/**
 * Generates a unique slug from the title, retrying with a numeric suffix
 * on collision — same retry-on-conflict shape as candidate-auth.ts's
 * registerCandidate/applicantNumber (let the unique constraint be the
 * final arbiter, don't pre-check-then-write).
 */
export async function createBlogPost(input: BlogPostInput, staffId: string) {
  const base = slugify(input.title) || "post";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const post = await prisma.blogPost.create({
        data: {
          slug,
          title: input.title,
          excerpt: input.excerpt,
          body: input.body,
          tags: input.tags,
          authorName: input.authorName,
          heroAssetId: input.heroAssetId ?? null,
          createdByStaffId: staffId,
        },
      });
      await recordAuditEvent(prisma, {
        actorStaffId: staffId,
        subjectType: "blog_post",
        subjectId: post.id,
        action: "blog_post.created",
        description: `Created the blog post "${post.title}"`,
      });
      return post;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("slug") && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique slug. Please choose one manually.");
}

export async function updateBlogPost(id: string, input: BlogPostInput) {
  return prisma.blogPost.update({
    where: { id },
    data: {
      title: input.title,
      excerpt: input.excerpt,
      body: input.body,
      tags: input.tags,
      authorName: input.authorName,
      heroAssetId: input.heroAssetId ?? null,
    },
  });
}

export interface PublishCheckFailure {
  reason: string;
}

export async function checkPublishable(id: string): Promise<PublishCheckFailure[]> {
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id } });
  const failures: PublishCheckFailure[] = [];
  if (!post.title.trim()) failures.push({ reason: "The post has no title." });
  if (isMarkupEmpty(post.body)) failures.push({ reason: "The post body is empty." });
  if (!post.slug.trim()) failures.push({ reason: "The post has no slug." });
  return failures;
}

export class PublishCheckError extends Error {
  failures: PublishCheckFailure[];
  constructor(failures: PublishCheckFailure[]) {
    super(failures.map((f) => f.reason).join(" "));
    this.name = "PublishCheckError";
    this.failures = failures;
  }
}

export async function publishBlogPost(id: string, staffId: string) {
  const failures = await checkPublishable(id);
  if (failures.length > 0) throw new PublishCheckError(failures);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.update({
      where: { id },
      data: { isPublished: true, publishedAt: now, publishedByStaffId: staffId, unpublishedAt: null },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "blog_post",
      subjectId: post.id,
      action: "blog_post.published",
      description: `Published the blog post "${post.title}"`,
    });
  });
}

export async function unpublishBlogPost(id: string, reason: string, staffId: string) {
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.blogPost.update({
      where: { id },
      data: { isPublished: false, unpublishedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "blog_post",
      subjectId: post.id,
      action: "blog_post.unpublished",
      description: `Unpublished the blog post "${post.title}"`,
      reason,
    });
  });
}

/** Hard delete is fine here — unlike enrolment-linked content, nothing references a blog post. */
export async function deleteBlogPost(id: string, staffId: string) {
  const post = await prisma.blogPost.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "blog_post",
      subjectId: post.id,
      action: "blog_post.deleted",
      description: `Deleted the blog post "${post.title}"`,
    });
    await tx.blogPost.delete({ where: { id } });
  });
}
