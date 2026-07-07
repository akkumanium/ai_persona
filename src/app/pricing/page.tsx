import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
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

const pageMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-page-mono",
  display: "swap",
});

export const metadata = {
  title: "Pricing | Persona Studio",
  description: "Choose a Persona Studio plan for persona capacity, assets, and welcome credits.",
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
      className={`${pageSans.variable} ${pageMono.variable} public-page text-[#f1ebe3]`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <PublicHeader initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} redirectPath="/pricing" />

      <section className="public-content mx-auto grid max-w-7xl gap-12 px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.62fr)] lg:items-center">
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
              ? "Your subscription connects to your saved workspace, persona capacity, and one-time welcome credits."
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
