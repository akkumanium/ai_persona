import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, PenLine } from "lucide-react";

import { isGuideAdmin } from "@/lib/guide-admin";
import { getGuideArticles } from "@/lib/guide-articles";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Guides | Persona Studio",
  description: "Practical guides for AI persona setup, model strategy, and traffic quality.",
};

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [articles, user] = await Promise.all([getGuideArticles(), getCurrentUser()]);
  const canManage = isGuideAdmin(user);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070711] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,79,163,0.18),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(116,92,246,0.18),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_42%,#160b1f_100%)]" />
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
          >
            <ArrowLeft size={16} />
            Home
          </Link>

          {canManage ? (
            <Link
              href="/guides/admin"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff4fa3] px-3 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8]"
            >
              <PenLine size={16} />
              Manage articles
            </Link>
          ) : null}
        </header>

        <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(280px,0.2fr)] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">
              Persona Studio guides
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
              Practical notes, one topic at a time.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#b6bacb] sm:text-lg">
              Short, editable articles for account setup, persona choices, and traffic quality.
              Pick a guide and read it on its own page.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText size={17} className="text-[#ff77b8]" />
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#aeb4c6]">
              Content is stored in Supabase when configured, with local fallback drafts for development.
            </p>
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/guides/${article.slug}`}
              className="group flex min-h-64 flex-col rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#ff4fa3]/45 hover:bg-white/[0.075]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">
                {article.eyebrow}
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-snug text-white">
                {article.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-[#aeb4c6]">{article.summary}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#ffd0e7]">
                Read article
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
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
