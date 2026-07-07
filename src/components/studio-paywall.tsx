import { LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";
import { BillingPlans } from "@/components/billing-plans";
import type { getPublicPaddleConfig } from "@/lib/billing";

export function StudioPaywall({
  userId,
  userEmail,
  supabaseReady,
  paddleConfig,
}: {
  userId?: string;
  userEmail?: string;
  supabaseReady: boolean;
  paddleConfig: ReturnType<typeof getPublicPaddleConfig>;
}) {
  return (
    <main className="min-h-screen bg-[#fff9fc] text-[#19141a]">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#19141a] text-[#ffd9ea]">
            <Sparkles size={19} />
          </span>
          <span className="text-base font-semibold tracking-normal">Persona Studio</span>
        </Link>
        <AuthButton initialUserEmail={userEmail} supabaseReady={supabaseReady} />
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-6 pt-10 text-center sm:px-8">
        <div className="mx-auto flex size-13 items-center justify-center rounded-lg bg-[#ffd9ea] text-[#9d2e65]">
          <LockKeyhole size={24} />
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
          Studio access starts with an active plan.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#695c66]">
          Choose a Paddle subscription to unlock the workspace. Every plan includes one-time welcome credits and a persona management limit.
        </p>
      </section>

      <BillingPlans
        title={userId ? "Select your plan" : "Sign in, then select a plan"}
        copy={
          userId
            ? "Pick the persona capacity that fits your production pace."
            : "Authentication connects the Paddle payment to your saved workspace and welcome credits."
        }
        userId={userId}
        userEmail={userEmail}
        supabaseReady={supabaseReady}
        config={paddleConfig}
        compact
      />
    </main>
  );
}
