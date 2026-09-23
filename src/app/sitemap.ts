import type { MetadataRoute } from "next";
import { getPublishedListings } from "@/lib/website-reads";
import { getPublishedBlogPosts } from "@/lib/blog-reads";
import { SITE_URL } from "@/lib/site-url";

const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/programmes", changeFrequency: "weekly", priority: 0.9 },
  { path: "/library", changeFrequency: "weekly", priority: 0.8 },
  { path: "/blog", changeFrequency: "daily", priority: 0.7 },
  { path: "/verify", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/register", changeFrequency: "monthly", priority: 0.6 },
  { path: "/sign-in", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, posts] = await Promise.all([
    getPublishedListings().catch(() => []),
    getPublishedBlogPosts().catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const programmeEntries: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${SITE_URL}/programmes/${l.code}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.publishedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...programmeEntries, ...blogEntries];
}
