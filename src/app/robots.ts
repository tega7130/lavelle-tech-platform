import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/portal",
        "/portal/",
        "/staff",
        "/staff/",
        "/api/",
        "/checkout",
        "/checkout/",
        "/pay",
        "/pay/",
        "/learn",
        "/learn/",
        "/sitting",
        "/sitting/",
        "/preview",
        "/preview/",
        "/forgot-password",
        "/programme-notifications/",
        "/sentry-example-page",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
