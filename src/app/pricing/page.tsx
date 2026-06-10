import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { BillingPlans } from "@/components/billing-plans";
import { getPublicPaddleConfig } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    <main className="min-h-screen bg-[#070711] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_22%_10%,rgba(255,79,163,0.16),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(141,183,255,0.13),transparent_26%),linear-gradient(135deg,#070711_0%,#0b0d1b_48%,#160b1f_100%)]" />
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md border border-[#ff4fa3]/40 bg-[#ff4fa3]/14 text-[#ff8fc7]">
            <Sparkles size={19} />
          </span>
          <span className="text-base font-semibold tracking-normal">Persona Studio</span>
        </Link>
        <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} variant="dark" />
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-4 pt-12 text-center sm:px-8">
        <Link
          href="/"
          className="mx-auto inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to homepage
        </Link>
        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
          Choose the monthly token balance that fits your production pace.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#aeb4c6]">
          Plans unlock the studio and add generation tokens after each successful subscription payment.
        </p>
      </section>

      <div className="pb-16">
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
      </div>
    </main>
  );
}
