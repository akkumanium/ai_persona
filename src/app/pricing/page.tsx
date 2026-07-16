import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PricingAccount } from "@/components/pricing-account";
import { getPublicBillingConfig } from "@/lib/billing";
import { hasSupabaseEnv } from "@/lib/env";

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
  title: "Pricing | Idolborn",
  description: "Choose an Idolborn plan for persona capacity, assets, and welcome credits.",
};

export default function PricingPage() {
  const supabaseReady = hasSupabaseEnv();

  return (
    <main
      className={`${pageSans.variable} ${pageMono.variable} public-page text-[#f1ebe3]`}
      style={{ fontFamily: "var(--font-page-sans), Arial, Helvetica, sans-serif" }}
    >
      <PublicHeader supabaseReady={supabaseReady} redirectPath="/pricing" />

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

      <PricingAccount supabaseReady={supabaseReady} config={getPublicBillingConfig()} />
    </main>
  );
}
