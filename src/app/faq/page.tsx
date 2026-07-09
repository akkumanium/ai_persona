import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "FAQ | Idolborn", description: "Answers to common questions." };

const questions = [
  ["What can I make in Studio?", "Create a persona, build consistent references, and turn them into images, videos, speech, and talking-avatar clips."],
  ["Can I explore before subscribing?", "Yes. Sign in to browse the entire Studio in preview mode. A paid plan adds the tokens required to generate."],
  ["Why should I choose Idolborn over Higgsfield or Wavespeed or other tools?", "These are great tools, but they are not specifically designed for creating AI influencers. They do not provide a streamlined way to create a single, consistent persona, produce short 9:16 videos within minutes, or offer guidance on managing social media accounts."],
  ["Can I cancel or request a refund?", "You can cancel from Studio settings or the pricing page. Your latest subscription payment is eligible for an automatic full refund only when none of its credits have been used."],
];

export default async function FaqPage() {
  const supabaseReady = hasSupabaseEnv();
  let initialUserEmail: string | undefined;

  if (supabaseReady) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialUserEmail = user?.email;
  }

  return (
    <main className="public-page px-5 py-8 text-white sm:px-8 lg:py-12">
      <PublicHeader initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} redirectPath="/faq" />
      <div className="public-content mx-auto w-full max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#b6bacb] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Home
        </Link>

        <header className="mx-auto mt-16 max-w-2xl text-center sm:mt-20">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-5 text-base leading-7 text-[#9095a7] sm:text-lg">
            Everything you need to know about creating, generating, and managing your work in Idolborn.
          </p>
        </header>

        <div className="mt-14 w-full border-t border-white/15 sm:mt-16">
          {questions.map(([question, answer]) => (
            <details key={question} className="group border-b border-white/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-left marker:content-none sm:py-4 [&::-webkit-details-marker]:hidden">
                <span className="text-[16px] font-medium leading-6 text-white sm:text-[18px]">{question}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 text-[#8f94a6] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-4xl pb-5 pr-10 text-[15px] leading-7 text-[#aeb4c6] sm:pb-6 sm:text-base">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
