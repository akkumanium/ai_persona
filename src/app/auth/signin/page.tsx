import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in | Persona Studio",
  description: "Sign in to Persona Studio.",
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabaseReady = hasSupabaseEnv();
  const next = normalizeNextPath((await searchParams).next);
  if (supabaseReady) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect(next);
    }
  }

  return (
    <main className="min-h-screen bg-[#070711] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md border border-[#ff4fa3]/40 bg-[#ff4fa3]/14 text-[#ff8fc7]">
            <Sparkles size={19} />
          </span>
          <span className="text-base font-semibold tracking-normal">Persona Studio</span>
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 text-sm font-semibold text-[#d9dce8] transition hover:border-[#ff4fa3]/60 hover:text-white"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
      </header>

      <section className="mx-auto grid max-w-xl justify-items-center px-5 py-20 text-center sm:px-8">
        <div className="flex size-13 items-center justify-center rounded-lg border border-[#ff4fa3]/35 bg-[#ff4fa3]/14 text-[#ff8fc7]">
          <Sparkles size={24} />
        </div>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
          Sign in to open Studio.
        </h1>
        <p className="mt-5 text-base leading-7 text-[#aeb4c6]">
          Your personas, prompts, generated images, videos, and token balance stay attached to your account.
        </p>
        <div className="mt-8">
          <AuthButton
            supabaseReady={supabaseReady}
            variant="dark"
            defaultOpen
            redirectPath={next}
          />
        </div>
      </section>
    </main>
  );
}

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/studio";
  return value;
}
