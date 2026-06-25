import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PenLine } from "lucide-react";

import { GuideMarkdown } from "@/components/guide-markdown";
import { isGuideAdmin } from "@/lib/guide-admin";
import { getGuideArticleBySlug, getGuideArticles } from "@/lib/guide-articles";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getGuideArticleBySlug(slug);

  if (!article) {
    return {
      title: "Guide not found | Persona Studio",
    };
  }

  return {
    title: `${article.title} | Persona Studio`,
    description: article.summary,
  };
}

export async function generateStaticParams() {
  const articles = await getGuideArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, user] = await Promise.all([getGuideArticleBySlug(slug), getCurrentUser()]);

  if (!article) notFound();

  const canManage = isGuideAdmin(user);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070711] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,79,163,0.18),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(116,92,246,0.18),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_42%,#160b1f_100%)]" />
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link
            href="/guides"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
          >
            <ArrowLeft size={16} />
            Guides
          </Link>

          {canManage ? (
            <Link
              href={`/guides/admin?edit=${article.slug}`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff4fa3] px-3 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8]"
            >
              <PenLine size={16} />
              Edit
            </Link>
          ) : null}
        </header>

        <article className="py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">
            {article.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
            {article.title}
          </h1>
          <p className="mt-5 border-b border-white/10 pb-8 text-lg leading-8 text-[#b6bacb]">
            {article.summary}
          </p>

          <div className="mt-10 rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur sm:p-8">
            <GuideMarkdown body={article.body} />
          </div>
        </article>
      </div>
    </main>
  );
}

async function getCurrentUser() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
