import Link from "next/link";
import Image from "next/image";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  LockKeyhole,
  PenLine,
  ShieldCheck,
} from "lucide-react";

import { AuthButton } from "@/components/auth/auth-button";
import { getGuideArticles, type GuideArticle } from "@/lib/guide-articles";
import { getGuideViewerAccess } from "@/lib/server/guide-access";

const pageSans = Inter({
  subsets: ["latin"],
  variable: "--font-page-sans",
  display: "swap",
});

const pageSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-page-serif",
  display: "swap",
});

const pageMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-page-mono",
  display: "swap",
});

export const metadata = {
  title: "Guides | Persona Studio",
  description: "Practical guides for AI persona setup, model strategy, and traffic quality.",
};

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [articles, access] = await Promise.all([getGuideArticles(), getGuideViewerAccess()]);
  const canManage = access.canManage;
  const hasGuideAccess = access.hasGuideAccess;

  return (
    <main
      className={`${pageSans.variable} ${pageSerif.variable} ${pageMono.variable} min-h-screen overflow-hidden bg-[#0c0a0b] px-5 py-5 text-[#f1ebe3] sm:px-8`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_900px_650px_at_18%_8%,rgba(255,77,109,0.14),transparent_58%),radial-gradient(ellipse_760px_600px_at_82%_14%,rgba(212,165,116,0.10),transparent_60%),linear-gradient(135deg,#0c0a0b_0%,#100d0f_48%,#171215_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22_width=%22200%22_height=%22200%22><filter_id=%22n%22><feTurbulence_type=%22fractalNoise%22_baseFrequency=%220.85%22_numOctaves=%223%22_stitchTiles=%22stitch%22/></filter><rect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/></svg>')]" />

      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1ebe3]/10 pb-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="relative size-5 rounded-full bg-[conic-gradient(from_180deg,#ff4d6d,#d4a574,#ff4d6d)] after:absolute after:inset-[5px] after:rounded-full after:bg-[#0c0a0b]" />
            <span
              className="text-xs tracking-[0.04em] text-[#f1ebe3]"
              style={{ fontFamily: "var(--font-page-mono), monospace" }}
            >
              persona/studio
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.04] px-4 text-sm font-semibold text-[#b3a9a0] transition hover:border-[#f1ebe3]/25 hover:text-[#f1ebe3]"
            >
              <ArrowLeft size={16} />
              Home
            </Link>
            {canManage ? (
              <Link
                href="/guides/admin"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ff4d6d] px-4 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82]"
              >
                <PenLine size={16} />
                Manage articles
              </Link>
            ) : null}
            <AuthButton
              initialUserEmail={access.userEmail}
              supabaseReady={access.supabaseReady}
              variant="dark"
              redirectPath="/guides"
            />
          </div>
        </header>

        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.55fr)] lg:items-end">
          <div>
            <p
              className="inline-flex items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[#b3a9a0]"
              style={{ fontFamily: "var(--font-page-mono), monospace" }}
            >
              <span className="size-1.5 rounded-full bg-[#ff4d6d] shadow-[0_0_12px_rgba(255,77,109,0.8)]" />
              Persona Studio guides
            </p>
            <h1
              className="mt-6 max-w-3xl text-5xl font-normal leading-[0.98] tracking-normal sm:text-7xl"
              style={{ fontFamily: "var(--font-page-serif), Georgia, serif" }}
            >
              Practical notes, <em className="text-[#ff4d6d]">one topic</em> at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#b3a9a0] sm:text-lg">
              Short, editable articles for account setup, persona choices, and traffic quality.
              Browse the library here; active members can open the full articles.
            </p>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] shadow-[0_40px_110px_rgba(0,0,0,0.42)]">
            <div className="grid grid-cols-3 gap-1 border-b border-[#f1ebe3]/10 p-2">
              {["guide-face-ref", "guide-body-ref", "guide-output-ref"].map((seed) => (
                <div key={seed} className="relative aspect-[4/5] overflow-hidden rounded-md bg-[#211b1d]">
                  <Image
                    src={`https://picsum.photos/seed/${seed}/240/300`}
                    alt=""
                    fill
                    unoptimized
                    sizes="110px"
                    className="object-cover opacity-85 saturate-90 sepia-[0.08]"
                  />
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f1ebe3]">
                {hasGuideAccess ? (
                  <ShieldCheck size={17} className="text-[#d4a574]" />
                ) : (
                  <LockKeyhole size={17} className="text-[#ff8a9b]" />
                )}
                {hasGuideAccess ? "Member access active" : "Members-only reading"}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#b3a9a0]">
                {articles.length} {articles.length === 1 ? "article is" : "articles are"} available in the library.
                {hasGuideAccess ? " Open any guide below." : " Subscribe to read the full playbooks."}
              </p>
            </div>
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
      <h2 className="mt-5 text-2xl font-normal leading-snug text-[#f1ebe3]" style={{ fontFamily: "var(--font-page-serif), Georgia, serif" }}>
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
