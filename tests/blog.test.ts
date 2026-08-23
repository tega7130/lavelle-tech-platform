import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import {
  createBlogPost,
  updateBlogPost,
  checkPublishable,
  publishBlogPost,
  unpublishBlogPost,
  deleteBlogPost,
  PublishCheckError,
} from "@/lib/blog-admin-actions";
import { getPublishedBlogPosts, getPublishedBlogPost } from "@/lib/blog-reads";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Test Blog Staff", email: `blog-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
}

async function cleanup(staffId: string, ...postIds: string[]) {
  await testPrisma.blogPost.deleteMany({ where: { id: { in: postIds } } });
  await testPrisma.staff.delete({ where: { id: staffId } }).catch(() => {});
}

const baseInput = {
  excerpt: "A test excerpt.",
  body: "A test paragraph.",
  tags: ["Test"],
  authorName: "Test Author",
};

describe("createBlogPost — slug generation and collision retry", () => {
  it("slugifies the title", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Hello, World! ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    expect(post.slug).toMatch(/^hello-world-/);
    await cleanup(staff.id, post.id);
  });

  it("retries with a numeric suffix on a slug collision instead of failing", async () => {
    const staff = await seedStaff();
    const title = `Collision Test ${crypto.randomUUID().slice(0, 6)}`;
    const first = await createBlogPost({ ...baseInput, title }, staff.id);
    const second = await createBlogPost({ ...baseInput, title }, staff.id);

    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith(first.slug)).toBe(true);

    await cleanup(staff.id, first.id, second.id);
  });

  it("records an audit event on creation", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Audit Test ${crypto.randomUUID().slice(0, 6)}` }, staff.id);

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "blog_post", subjectId: post.id, action: "blog_post.created" },
    });
    expect(event).not.toBeNull();
    expect(event?.actorStaffId).toBe(staff.id);

    await cleanup(staff.id, post.id);
  });
});

describe("checkPublishable / publishBlogPost", () => {
  it("passes a post with a title, body and slug", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Publishable ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    expect(await checkPublishable(post.id)).toEqual([]);
    await cleanup(staff.id, post.id);
  });

  it("fails a post with an empty title", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Temp ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await testPrisma.blogPost.update({ where: { id: post.id }, data: { title: "" } });

    const failures = await checkPublishable(post.id);
    expect(failures.some((f) => f.reason.includes("no title"))).toBe(true);

    await cleanup(staff.id, post.id);
  });

  it("fails a post whose body is empty markup — isMarkupEmpty, not a raw trim() check", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Empty Body ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    // Whitespace-only markup that a naive .trim() on the raw string would
    // still treat as non-empty (it isn't literally "").
    await testPrisma.blogPost.update({ where: { id: post.id }, data: { body: "\n\n" } });

    const failures = await checkPublishable(post.id);
    expect(failures.some((f) => f.reason.includes("body is empty"))).toBe(true);

    await cleanup(staff.id, post.id);
  });

  it("publishBlogPost refuses (throws PublishCheckError) when a check fails, and leaves the post unpublished", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Refuse ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await testPrisma.blogPost.update({ where: { id: post.id }, data: { body: "" } });

    await expect(publishBlogPost(post.id, staff.id)).rejects.toThrow(PublishCheckError);
    const refreshed = await testPrisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(refreshed.isPublished).toBe(false);

    await cleanup(staff.id, post.id);
  });

  it("publishBlogPost sets isPublished/publishedAt/publishedByStaffId and records an audit event", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Publish Me ${crypto.randomUUID().slice(0, 6)}` }, staff.id);

    await publishBlogPost(post.id, staff.id);

    const refreshed = await testPrisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(refreshed.isPublished).toBe(true);
    expect(refreshed.publishedAt).not.toBeNull();
    expect(refreshed.publishedByStaffId).toBe(staff.id);

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "blog_post", subjectId: post.id, action: "blog_post.published" },
    });
    expect(event).not.toBeNull();

    await cleanup(staff.id, post.id);
  });
});

describe("unpublishBlogPost", () => {
  it("requires a non-empty reason on the audit event and flips isPublished back to false", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Unpublish Me ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await publishBlogPost(post.id, staff.id);

    await unpublishBlogPost(post.id, "Needs a rewrite", staff.id);

    const refreshed = await testPrisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(refreshed.isPublished).toBe(false);
    expect(refreshed.unpublishedAt).not.toBeNull();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "blog_post", subjectId: post.id, action: "blog_post.unpublished" },
      orderBy: { createdAt: "desc" },
    });
    expect(event?.reason).toBe("Needs a rewrite");

    await cleanup(staff.id, post.id);
  });

  it("an unpublished post stays editable — updateBlogPost still works, and it can be republished", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Republish Me ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await publishBlogPost(post.id, staff.id);
    await unpublishBlogPost(post.id, "Draft revisions", staff.id);

    await updateBlogPost(post.id, { ...baseInput, title: post.title, excerpt: "Revised excerpt." });
    await publishBlogPost(post.id, staff.id);

    const refreshed = await testPrisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(refreshed.isPublished).toBe(true);
    expect(refreshed.excerpt).toBe("Revised excerpt.");

    await cleanup(staff.id, post.id);
  });
});

describe("deleteBlogPost", () => {
  it("records an audit event before removing the row", async () => {
    const staff = await seedStaff();
    const post = await createBlogPost({ ...baseInput, title: `Delete Me ${crypto.randomUUID().slice(0, 6)}` }, staff.id);

    await deleteBlogPost(post.id, staff.id);

    const gone = await testPrisma.blogPost.findUnique({ where: { id: post.id } });
    expect(gone).toBeNull();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "blog_post", subjectId: post.id, action: "blog_post.deleted" },
    });
    expect(event).not.toBeNull();

    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("getPublishedBlogPosts / getPublishedBlogPost — published rows only", () => {
  it("a draft post is invisible to both reads; a published one is visible to both", async () => {
    const staff = await seedStaff();
    const draftTitle = `Draft Only ${crypto.randomUUID().slice(0, 6)}`;
    const publishedTitle = `Published ${crypto.randomUUID().slice(0, 6)}`;

    const draft = await createBlogPost({ ...baseInput, title: draftTitle }, staff.id);
    const published = await createBlogPost({ ...baseInput, title: publishedTitle }, staff.id);
    await publishBlogPost(published.id, staff.id);

    const list = await getPublishedBlogPosts();
    expect(list.some((p) => p.slug === draft.slug)).toBe(false);
    expect(list.some((p) => p.slug === published.slug)).toBe(true);

    expect(await getPublishedBlogPost(draft.slug)).toBeNull();
    const detail = await getPublishedBlogPost(published.slug);
    expect(detail?.title).toBe(publishedTitle);

    await cleanup(staff.id, draft.id, published.id);
  });

  it("getPublishedBlogPost returns null for a slug that was never published, and for one that no longer exists", async () => {
    expect(await getPublishedBlogPost(`nonexistent-${crypto.randomUUID()}`)).toBeNull();
  });

  it("orders published posts newest-published-first", async () => {
    const staff = await seedStaff();
    const older = await createBlogPost({ ...baseInput, title: `Older ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await publishBlogPost(older.id, staff.id);
    await testPrisma.blogPost.update({ where: { id: older.id }, data: { publishedAt: new Date("2020-01-01") } });

    const newer = await createBlogPost({ ...baseInput, title: `Newer ${crypto.randomUUID().slice(0, 6)}` }, staff.id);
    await publishBlogPost(newer.id, staff.id);

    const list = await getPublishedBlogPosts();
    const olderIndex = list.findIndex((p) => p.slug === older.slug);
    const newerIndex = list.findIndex((p) => p.slug === newer.slug);
    expect(newerIndex).toBeLessThan(olderIndex);

    await cleanup(staff.id, older.id, newer.id);
  });
});
