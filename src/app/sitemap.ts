import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://idolborn.ai";
  return ["", "/pricing", "/faq", "/contact", "/guides", "/privacy", "/terms"].map((path) => ({ url: `${origin}${path}`, lastModified: new Date(), changeFrequency: path ? "weekly" : "daily" }));
}
