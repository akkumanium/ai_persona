import Link from "next/link";
import { ArrowLeft, HelpCircle } from "lucide-react";

export const metadata = { title: "FAQ | Persona Studio", description: "Answers to common Persona Studio questions." };

const questions = [
  ["What can I make in Studio?", "Create a persona, build consistent references, and turn them into images, videos, speech, and talking-avatar clips."],
  ["Can I explore before subscribing?", "Yes. Sign in to browse the entire Studio in preview mode. A paid plan adds the tokens required to generate."],
  ["How do tokens work?", "Each generation shows an estimated token cost. Tokens are deducted only when a generation starts and are returned automatically if it fails."],
  ["Can I cancel or request a refund?", "You can cancel from Studio settings or the pricing page. Your latest subscription payment is eligible for an automatic full refund only when none of its credits have been used."],
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-[#070711] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#ffd0e7] hover:text-white"><ArrowLeft size={16} />Home</Link>
        <div className="mt-12 flex size-12 items-center justify-center rounded-md bg-[#ff4fa3]/15 text-[#ff8fc7]"><HelpCircle /></div>
        <h1 className="mt-5 text-4xl font-semibold sm:text-6xl">Frequently asked questions</h1>
        <p className="mt-4 text-[#aeb4c6]">Starter copy for now—replace or expand these answers whenever you’re ready.</p>
        <div className="mt-10 grid gap-4">
          {questions.map(([question, answer]) => (
            <article key={question} className="rounded-lg border border-white/10 bg-white/[0.055] p-6">
              <h2 className="text-lg font-semibold">{question}</h2>
              <p className="mt-3 leading-7 text-[#b6bacb]">{answer}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
