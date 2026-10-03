import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/login", "/ticket/"] },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
