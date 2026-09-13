import { OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE, renderOgImage } from "@/lib/og-image";
import { getPublishedBlogPost } from "@/lib/blog-reads";

export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);

  return renderOgImage({
    eyebrow: "Lavelle Institute Blog",
    title: post?.title ?? "Post not found",
    subtitle: post?.excerpt,
  });
}
