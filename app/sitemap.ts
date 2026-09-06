import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** List only public, search-oriented pages — never auth or authenticated routes. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
