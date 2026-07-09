import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, FilePlus2, PenLine } from "lucide-react";

import { AuthButton } from "@/components/auth/auth-button";
import { isGuideAdmin } from "@/lib/guide-admin";
import { getGuideArticles, type GuideArticle } from "@/lib/guide-articles";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveGuideArticle } from "./actions";

export const metadata = {
  title: "Manage Guides | Idolborn",
  description: "Create and edit Idolborn guide articles.",
};

export const dynamic = "force-dynamic";

export default async function GuideAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const supabaseReady = hasSupabaseEnv();
  const user = await getCurrentUser();
  const canManage = isGuideAdmin(user);

  if (!supabaseReady) {
    return <AdminShell message="Supabase is not configured, so article editing is unavailable." />;
  }

  if (!user) {
    return (
      <AdminShell message="Sign in with the admin account to manage guide articles.">
        <AuthButton
          initialUserEmail={undefined}
          supabaseReady={supabaseReady}
          variant="dark"
          defaultOpen
          redirectPath="/guides/admin"
        />
      </AdminShell>
    );
  }

  if (!canManage) {
    return <AdminShell message="This account does not have permission to manage guides." />;
  }

  const articles = await getGuideArticles({ includeDrafts: true });
  const editArticle = articles.find((article) => article.slug === params.edit) ?? articles[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070711] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,79,163,0.18),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(116,92,246,0.18),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_42%,#160b1f_100%)]" />
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link
            href="/guides"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
          >
            <ArrowLeft size={16} />
            Guides
          </Link>
          <Link
            href="/guides/admin"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff4fa3] px-3 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8]"
          >
            <FilePlus2 size={16} />
            New article
          </Link>
        </header>

        <section className="py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">
            Guide admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
            Create and edit articles.
          </h1>
          {params.saved ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-md border border-[#72e0c4]/35 bg-[#72e0c4]/12 px-3 py-2 text-sm font-semibold text-[#b6fff0]">
              <CheckCircle2 size={16} />
              Article saved.
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 pb-16 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur">
            <p className="text-sm font-semibold text-white">Articles</p>
            <div className="mt-4 grid gap-2">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/guides/admin?edit=${article.slug}`}
                  className={`rounded-md border px-3 py-3 text-sm transition ${
                    article.slug === editArticle?.slug
                      ? "border-[#ff4fa3]/45 bg-[#ff4fa3]/[0.13] text-white"
                      : "border-white/10 bg-[#0d1020] text-[#c3cadb] hover:border-[#ff4fa3]/45 hover:text-white"
                  }`}
                >
                  <span className="block font-semibold">{article.title}</span>
                  <span className="mt-1 block text-xs opacity-75">
                    {article.published ? "Published" : "Draft"} / {article.slug}
                  </span>
                </Link>
              ))}
            </div>
          </aside>

          <div className="grid gap-6">
            <ArticleForm key="new-article" title="Create Article" />
            {editArticle ? (
              <ArticleForm key={editArticle.slug} title="Edit Article" article={editArticle} />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function ArticleForm({ title, article }: { title: string; article?: GuideArticle }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur sm:p-6">
      <div className="flex items-center gap-2">
        <PenLine size={18} className="text-[#ff77b8]" />
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>

      <form action={saveGuideArticle} className="mt-5 grid gap-4">
        <input type="hidden" name="id" defaultValue={article?.id ?? ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Title" name="title" defaultValue={article?.title} required />
          <TextField label="Slug" name="slug" defaultValue={article?.slug} placeholder="my-guide-slug" required />
        </div>

        <TextField label="Eyebrow" name="eyebrow" defaultValue={article?.eyebrow} placeholder="Short category label" />
        <TextArea
          label="Summary"
          name="summary"
          defaultValue={article?.summary}
          rows={3}
          required
        />
        <TextArea
          label="Body"
          name="body"
          defaultValue={article?.body}
          rows={18}
          placeholder="Use ## headings, - bullets, and **bold** text."
          required
        />

        <label className="flex items-center gap-3 text-sm font-semibold text-[#d7dbea]">
          <input
            type="checkbox"
            name="published"
            defaultChecked={article?.published ?? true}
            className="size-4"
          />
          Published
        </label>

        <button
          type="submit"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8]"
        >
          <CheckCircle2 size={17} />
          Save article
        </button>
      </form>
    </section>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#d7dbea]">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="guide-admin-field h-11 rounded-md border border-white/[0.14] px-3 text-sm outline-none transition focus:border-[#ff4fa3]"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  rows,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-[#d7dbea]">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="guide-admin-field rounded-md border border-white/[0.14] px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#ff4fa3]"
      />
    </label>
  );
}

function AdminShell({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070711] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,79,163,0.18),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(116,92,246,0.18),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_42%,#160b1f_100%)]" />
      <div className="mx-auto max-w-3xl">
        <Link
          href="/guides"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
        >
          <ArrowLeft size={16} />
          Guides
        </Link>
        <section className="mt-12 rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur">
          <h1 className="text-3xl font-semibold">Guide admin</h1>
          <p className="mt-3 text-base leading-7 text-[#b6bacb]">{message}</p>
          {children ? <div className="mt-6">{children}</div> : null}
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
