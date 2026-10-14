import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The employee portal, customer portal, and warehouse app are internal tools behind
// auth — they shouldn't be crawled or shown as Renew Lighting in search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/employee", "/portal", "/warehouse", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
