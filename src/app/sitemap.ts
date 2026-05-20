import type { MetadataRoute } from "next";

/** Falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL in production. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://wharfsidemb.com";

const ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/rules", changeFrequency: "monthly", priority: 0.9 },
  { path: "/map", changeFrequency: "yearly", priority: 0.8 },
  { path: "/transient", changeFrequency: "monthly", priority: 0.9 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.7 },
  { path: "/emergency", changeFrequency: "yearly", priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services", changeFrequency: "monthly", priority: 0.6 },
  { path: "/forms", changeFrequency: "monthly", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
