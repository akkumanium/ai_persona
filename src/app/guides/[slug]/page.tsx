import Link from "next/link";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft, CreditCard, LockKeyhole, PenLine, ShieldCheck } from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { GuideMarkdown } from "@/components/guide-markdown";
import { getGuideArticleBySlug, getGuideArticles } from "@/lib/guide-articles";
import { getGuideViewerAccess, type GuideViewerAccess } from "@/lib/server/guide-access";

const pageSans = Inter({
  subsets: ["latin"],
  variable: "--font-page-sans",
  display: "swap",
});

const pageMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-page-mono",
  display: "swap",
});

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
  const [article, access] = await Promise.all([getGuideArticleBySlug(slug), getGuideViewerAccess()]);

  if (!article) notFound();

  const canManage = access.canManage;

  return (
    <main
      className={`${pageSans.variable} ${pageMono.variable} public-page px-5 py-5 text-[#f1ebe3] sm:px-8`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <PublicHeader
        initialUserEmail={access.userEmail}
        supabaseReady={access.supabaseReady}
        redirectPath={`/guides/${article.slug}`}
      />
      <div className="public-content mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <Link
            href="/guides"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.04] px-4 text-sm font-semibold text-[#b3a9a0] transition hover:border-[#f1ebe3]/25 hover:text-[#f1ebe3]"
          >
            <ArrowLeft size={16} />
            Guides
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canManage ? (
              <Link
                href={`/guides/admin?edit=${article.slug}`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ff4d6d] px-4 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82]"
              >
                <PenLine size={16} />
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <article className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
            <div>
              <p
                className="inline-flex items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[#b3a9a0]"
                style={{ fontFamily: "var(--font-page-mono), monospace" }}
              >
                <span className="size-1.5 rounded-full bg-[#ff4d6d] shadow-[0_0_12px_rgba(255,77,109,0.8)]" />
                {article.eyebrow}
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[0.98] tracking-normal sm:text-7xl">
                {article.title}
              </h1>
              <p className="mt-6 text-lg leading-8 text-[#b3a9a0]">
                {article.summary}
              </p>
            </div>

            <aside className="rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f1ebe3]">
                {access.hasGuideAccess ? (
                  <ShieldCheck size={17} className="text-[#d4a574]" />
                ) : (
                  <LockKeyhole size={17} className="text-[#ff8a9b]" />
                )}
                {access.hasGuideAccess ? "Full article" : "Member guide"}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#b3a9a0]">
                {access.hasGuideAccess
                  ? "Your plan includes this guide and the complete library."
                  : "Subscribe once, then read every playbook in the library."}
              </p>
            </aside>
          </div>

          {access.hasGuideAccess ? (
            <div className="mt-10 rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-5 shadow-[0_35px_110px_rgba(0,0,0,0.36)] sm:p-8">
              <GuideMarkdown body={article.body} />
            </div>
          ) : (
            <GuideArticlePaywall access={access} slug={article.slug} />
          )}
        </article>
      </div>
    </main>
  );
}

function GuideArticlePaywall({ access, slug }: { access: GuideViewerAccess; slug: string }) {
  return (
    <section className="mt-10 overflow-hidden rounded-[14px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="grid gap-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-[#ff8a9b]/35 bg-[#ff4d6d]/15 text-[#ffd0e7]">
              <LockKeyhole size={22} />
            </div>
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a574]"
                style={{ fontFamily: "var(--font-page-mono), monospace" }}
              >
                Member guide
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-[#f1ebe3]">
                Subscribe to read the full article.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d8cec3]">
                Guide pages are included with active Persona Studio plans, alongside generation access and monthly tokens.
              </p>
            </div>
          </div>
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.05] px-3 text-sm font-semibold text-[#ffd0e7]">
            <LockKeyhole size={16} />
            Locked
          </span>
        </div>

        <div className="grid gap-4 border-t border-[#f1ebe3]/10 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-[#f1ebe3]">Full playbooks</p>
            <p className="mt-2 text-sm leading-6 text-[#b3a9a0]">Read every guide in the library.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1ebe3]">Studio tokens</p>
            <p className="mt-2 text-sm leading-6 text-[#b3a9a0]">Generate images, video, speech, and avatars.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1ebe3]">Saved workflow</p>
            <p className="mt-2 text-sm leading-6 text-[#b3a9a0]">Keep personas, assets, and jobs tied to your account.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!access.userId ? (
            <Link
              href={`/auth/signin?next=/guides/${slug}`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#f1ebe3]/15 bg-[#f1ebe3]/[0.06] px-5 text-sm font-semibold text-[#f1ebe3] transition hover:border-[#ff4d6d]/70"
            >
              <ShieldCheck size={17} />
              Sign in
            </Link>
          ) : null}
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ff4d6d] px-5 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.24)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82]"
          >
            <CreditCard size={17} />
            View plans
          </Link>
        </div>
      </div>
    </section>
  );
}
