import Link from "next/link";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft } from "lucide-react";
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
            Pricing
          </p>
        </div>

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
