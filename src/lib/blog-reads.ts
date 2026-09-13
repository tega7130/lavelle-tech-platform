import "server-only";
import { prisma } from "@/lib/prisma";
import { getSignedAssetUrl } from "@/lib/storage";

/**
 * A broken hero image (bad storage credentials, a deleted asset) must
 * degrade to "no image" for that one post, never take down the whole
 * /blog index or /blog/[slug] for every visitor.
 */
async function safeHeroImageUrl(storageKey: string | undefined): Promise<string | null> {
  if (!storageKey) return null;
  try {
    return await getSignedAssetUrl(storageKey);
  } catch (error) {
    console.error(`Failed to build hero image URL for asset ${storageKey}:`, error);
    return null;
  }
}

/**
 * Not staff-gated — called from both the public marketing site (/blog)
 * and the signed-in candidate portal (/portal/blog), which read the same
 * published rows since a post has no candidate-specific or payment-gated
 * content (unlike the Catalogue).
 */
export async function getPublishedBlogPosts() {
  const rows = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    include: { heroAsset: { select: { storageKey: true } } },
  });
  return Promise.all(
    rows.map(async (p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      tags: (p.tags as string[] | null) ?? [],
      authorName: p.authorName,
      publishedAt: p.publishedAt!,
      heroImageUrl: await safeHeroImageUrl(p.heroAsset?.storageKey),
    }))
  );
}

/** Returns null if the post doesn't exist or isn't published — same shape as getListingDetail's not-published-returns-null rule. */
export async function getPublishedBlogPost(slug: string) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: { heroAsset: { select: { storageKey: true } } },
  });
  if (!post || !post.isPublished) return null;

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    tags: (post.tags as string[] | null) ?? [],
    authorName: post.authorName,
    publishedAt: post.publishedAt!,
    heroImageUrl: await safeHeroImageUrl(post.heroAsset?.storageKey),
  };
}
