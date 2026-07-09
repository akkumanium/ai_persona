import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import {
  ArrowRight,
  CreditCard,
  LockKeyhole,
  PenLine,
  ShieldCheck,
} from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { getGuideArticles, type GuideArticle } from "@/lib/guide-articles";
import { getGuideViewerAccess } from "@/lib/server/guide-access";

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

export const metadata = {
  title: "Guides | Idolborn",
  description: "Practical guides for AI persona setup, model strategy, and traffic quality.",
};

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [articles, access] = await Promise.all([getGuideArticles(), getGuideViewerAccess()]);
  const canManage = access.canManage;
  const hasGuideAccess = access.hasGuideAccess;

  return (
    <main
      className={`${pageSans.variable} ${pageMono.variable} public-page px-5 py-5 text-[#f1ebe3] sm:px-8`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <PublicHeader
        initialUserEmail={access.userEmail}
        supabaseReady={access.supabaseReady}
        redirectPath="/guides"
      />

      <div className="public-content mx-auto w-full max-w-6xl">
        <section className="py-14 sm:py-20">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
            <p
              className="inline-flex items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[#b3a9a0]"
              style={{ fontFamily: "var(--font-page-mono), monospace" }}
            >
              <span className="size-1.5 rounded-full bg-[#ff4d6d] shadow-[0_0_12px_rgba(255,77,109,0.8)]" />
              Idolborn guides
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal sm:text-7xl">
              Guides
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#b3a9a0] sm:text-lg">
              Short, editable guides for account setup, persona choices, and traffic quality.
            </p>
            </div>
            {canManage ? (
              <Link
                href="/guides/admin"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ff4d6d] px-4 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82]"
              >
                <PenLine size={16} />
                Manage articles
              </Link>
            ) : null}
          </div>
        </section>

        {!hasGuideAccess ? (
          <section className="mb-8 overflow-hidden rounded-[14px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#ff8a9b]/35 bg-[#ff4d6d]/15 text-[#ffd0e7]">
                  <LockKeyhole size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-normal text-[#f1ebe3]">Guides unlock with an active plan.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d8cec3]">
                    You can preview every topic, but full article pages are reserved for subscribed accounts.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {!access.userId ? (
                  <Link
                    href="/auth/signin?next=/guides"
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
        ) : null}

        <section className="grid gap-4 pb-20 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article, index) => (
            <GuideCard key={article.slug} article={article} locked={!hasGuideAccess} index={index} />
          ))}
        </section>
      </div>
    </main>
  );
}

function GuideCard({ article, locked, index }: { article: GuideArticle; locked: boolean; index: number }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4a574]">
          {article.eyebrow}
        </p>
        {locked ? (
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.05] text-[#ff8a9b]">
            <LockKeyhole size={16} />
          </span>
        ) : null}
      </div>
      <h2 className="mt-5 text-2xl font-semibold leading-snug text-[#f1ebe3]">
        {article.title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-[#b3a9a0]">{article.summary}</p>
      <div className="mt-7 flex items-center justify-between gap-4 border-t border-[#f1ebe3]/10 pt-5">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[#7a716a]" style={{ fontFamily: "var(--font-page-mono), monospace" }}>
          {String(index + 1).padStart(2, "0")} / guide
        </span>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a9b]">
          {locked ? "Subscribe" : "Read"}
          {locked ? <LockKeyhole size={16} /> : <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />}
        </span>
      </div>
    </>
  );

  const className =
    "group flex min-h-72 flex-col rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition";

  if (locked) {
    return (
      <article className={`${className} cursor-default opacity-90`}>
        {content}
      </article>
    );
  }

  return (
    <Link
      href={`/guides/${article.slug}`}
      className={`${className} hover:-translate-y-0.5 hover:border-[#ff4d6d]/45 hover:bg-[#f1ebe3]/[0.04]`}
    >
      {content}
    </Link>
  );
}
