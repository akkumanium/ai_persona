import { guides } from "@/content/guides";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type GuideArticle = {
  id?: string;
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  body: string;
  published: boolean;
  updatedAt?: string;
};

type GuideArticleRow = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  body: string;
  published: boolean;
  updated_at: string;
};

export const fallbackGuideArticles: GuideArticle[] = guides.map((guide) => ({
  slug: guide.slug,
  title: guide.title,
  eyebrow: guide.eyebrow,
  summary: guide.summary,
  body: guide.sections
    .map((section) => {
      const parts = [`## ${section.title}`];
      if (section.intro) parts.push(section.intro);
      if (section.paragraphs?.length) parts.push(...section.paragraphs);
      if (section.bullets?.length) {
        parts.push(
          section.bullets
            .map((bullet) =>
              bullet.title ? `- **${bullet.title}**: ${bullet.text}` : `- ${bullet.text}`,
            )
            .join("\n"),
        );
      }
      if (section.closing) parts.push(section.closing);
      return parts.join("\n\n");
    })
    .join("\n\n"),
  published: true,
}));

export async function getGuideArticles({ includeDrafts = false } = {}) {
  const dbArticles = await getGuideArticlesFromDatabase(includeDrafts);
  return dbArticles ?? fallbackGuideArticles;
}

export async function getGuideArticleBySlug(slug: string, { includeDrafts = false } = {}) {
  const articles = await getGuideArticles({ includeDrafts });
  return articles.find((article) => article.slug === slug && (includeDrafts || article.published));
}

async function getGuideArticlesFromDatabase(includeDrafts: boolean) {
  if (!hasSupabaseEnv()) return null;

  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("guide_articles")
      .select("id, slug, title, eyebrow, summary, body, published, updated_at")
      .order("created_at", { ascending: true });

    if (!includeDrafts) {
      query = query.eq("published", true);
    }

    const { data, error } = await query;
    if (error) return null;
    return (data as GuideArticleRow[]).map(mapGuideArticleRow);
  } catch {
    return null;
  }
}

function mapGuideArticleRow(row: GuideArticleRow): GuideArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    eyebrow: row.eyebrow,
    summary: row.summary,
    body: row.body,
    published: row.published,
    updatedAt: row.updated_at,
  };
}
