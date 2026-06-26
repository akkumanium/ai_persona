import Link from "next/link";
import Image from "next/image";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { BillingPlans } from "@/components/billing-plans";
import { BillingManagement } from "@/components/billing-management";
import { getPublicPaddleConfig } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  title: "Pricing | Persona Studio",
  description: "Choose a Persona Studio plan for saved personas, assets, and generation tokens.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabaseReady = hasSupabaseEnv();
  let initialUserEmail: string | undefined;
  let initialUserId: string | undefined;

  if (supabaseReady) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    initialUserEmail = user?.email;
    initialUserId = user?.id;
  }

  return (
    <main
      className={`${pageSans.variable} ${pageSerif.variable} ${pageMono.variable} min-h-screen overflow-hidden bg-[#0c0a0b] text-[#f1ebe3]`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_900px_650px_at_22%_8%,rgba(255,77,109,0.14),transparent_58%),radial-gradient(ellipse_760px_600px_at_82%_12%,rgba(212,165,116,0.11),transparent_60%),linear-gradient(135deg,#0c0a0b_0%,#100d0f_48%,#171215_100%)]" />
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-[#f1ebe3]/10 px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="relative size-5 rounded-full bg-[conic-gradient(from_180deg,#ff4d6d,#d4a574,#ff4d6d)] after:absolute after:inset-[5px] after:rounded-full after:bg-[#0c0a0b]" />
          <span
            className="text-xs tracking-[0.04em] text-[#f1ebe3]"
            style={{ fontFamily: "var(--font-page-mono), monospace" }}
          >
            persona/studio
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/guides"
            className="hidden h-10 items-center rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.04] px-4 text-sm font-semibold text-[#b3a9a0] transition hover:border-[#f1ebe3]/25 hover:text-[#f1ebe3] sm:inline-flex"
          >
            Guides
          </Link>
          <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} variant="dark" />
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.62fr)] lg:items-center">
        <div>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.04] px-4 text-sm font-semibold text-[#b3a9a0] transition hover:border-[#f1ebe3]/25 hover:text-[#f1ebe3]"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <p
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[#b3a9a0]"
            style={{ fontFamily: "var(--font-page-mono), monospace" }}
          >
            <span className="size-1.5 rounded-full bg-[#ff4d6d] shadow-[0_0_12px_rgba(255,77,109,0.8)]" />
            Token transparency
          </p>
          <h1
            className="mt-6 max-w-4xl text-5xl font-normal leading-[0.98] tracking-normal sm:text-7xl"
            style={{ fontFamily: "var(--font-page-serif), Georgia, serif" }}
          >
            Choose the pace. <em className="text-[#ff4d6d]">See the cost.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[#b3a9a0] sm:text-lg">
            Studio is free to explore after signing in. Plans add the monthly tokens needed to generate images,
            video, speech, and avatars without hidden generation fees.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#d8cec3]">
            {["Cancel anytime", "Tokens shown before every run", "Guides included with active plans"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full border border-[#f1ebe3]/10 bg-[#f1ebe3]/[0.04] px-3 py-2">
                <Check size={15} className="text-[#d4a574]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-4 shadow-[0_45px_120px_rgba(0,0,0,0.46)]">
          <div className="grid grid-cols-3 gap-2">
            {["pricing-persona-face", "pricing-video-frame", "pricing-avatar"].map((seed, index) => (
              <div
                key={seed}
                className={`relative overflow-hidden rounded-lg bg-[#211b1d] ${index === 1 ? "aspect-[3/4]" : "aspect-[4/5] translate-y-5"}`}
              >
                <Image
                  src={`https://picsum.photos/seed/${seed}/320/420`}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 30vw, 150px"
                  className="object-cover saturate-90 sepia-[0.08]"
                />
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-[#f1ebe3]/10 bg-[#0c0a0b]/60 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#f1ebe3]">Example run</p>
                <p className="mt-1 text-xs text-[#7a716a]">shown before checkout</p>
              </div>
              <span className="rounded-full border border-[#d4a574]/30 px-3 py-1 text-xs font-semibold text-[#d4a574]">
                1,840 tokens
              </span>
            </div>
            <PricingMeter label="4K image batch" value="360" width="18%" />
            <PricingMeter label="4-second video" value="880" width="64%" />
            <PricingMeter label="Talking avatar" value="600" width="46%" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-8 sm:px-8 md:grid-cols-3">
        <PricingNote title="Flat access" copy="Your plan activates the workspace and refreshes your generation balance monthly." />
        <PricingNote title="Visible token math" copy="The studio shows estimated token cost before image, video, speech, or avatar runs." />
        <PricingNote title="Practical guides" copy="Active plans include the guide library, so setup and production live together." />
      </section>

      <div className="pb-20">
        <BillingPlans
          title={initialUserId ? "Select your plan" : "Sign in, then select a plan"}
          copy={
            initialUserId
              ? "Your subscription connects to your saved workspace and token balance."
              : "Authentication connects the Paddle payment to your workspace before checkout."
          }
          userId={initialUserId}
          userEmail={initialUserEmail}
          supabaseReady={supabaseReady}
          config={getPublicPaddleConfig()}
          compact
          theme="dark"
        />
        {initialUserId ? (
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <BillingManagement dark />
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PricingMeter({ label, value, width }: { label: string; value: string; width: string }) {
  return (
    <div className="border-t border-[#f1ebe3]/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-[#b3a9a0]">{label}</span>
        <span className="text-[#f1ebe3]">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#f1ebe3]/10">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff4d6d,#d4a574)]" style={{ width }} />
      </div>
    </div>
  );
}

function PricingNote({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214]/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="mb-4 inline-flex size-9 items-center justify-center rounded-md border border-[#d4a574]/25 bg-[#d4a574]/10 text-[#d4a574]">
        <ShieldCheck size={17} />
      </div>
      <h2 className="text-lg font-semibold text-[#f1ebe3]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#b3a9a0]">{copy}</p>
    </div>
  );
}
