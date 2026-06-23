import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";

export const metadata = { title: "FAQ | Persona Studio", description: "Answers to common Persona Studio questions." };

const questions = [
  ["What can I make in Studio?", "Create a persona, build consistent references, and turn them into images, videos, speech, and talking-avatar clips."],
  ["Can I explore before subscribing?", "Yes. Sign in to browse the entire Studio in preview mode. A paid plan adds the tokens required to generate."],
  ["How do tokens work?", "Each generation shows an estimated token cost. Tokens are deducted only when a generation starts and are returned automatically if it fails."],
  ["Can I cancel or request a refund?", "You can cancel from Studio settings or the pricing page. Your latest subscription payment is eligible for an automatic full refund only when none of its credits have been used."],
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#070711] px-5 py-8 text-white sm:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#b6bacb] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Home
        </Link>

        <header className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-5 text-base leading-7 text-[#9095a7] sm:text-lg">
            Everything you need to know about creating, generating, and managing your work in Persona Studio.
          </p>
        </header>

        <div className="mt-14 w-full border-t border-white/15 sm:mt-16">
          {questions.map(([question, answer]) => (
            <details key={question} className="group border-b border-white/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-7 text-left marker:content-none sm:py-9 [&::-webkit-details-marker]:hidden">
                <span className="text-base font-semibold text-white sm:text-lg">{question}</span>
                <ChevronDown
                  size={18}
                  className="shrink-0 text-[#8f94a6] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-4xl pb-8 pr-10 leading-7 text-[#aeb4c6] sm:pb-10">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
