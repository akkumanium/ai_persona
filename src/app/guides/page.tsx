import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

export const metadata = { title: "Guides | Persona Studio", description: "Human-written guides for building AI personas." };

const guides = [
  ["Build a persona that stays recognizable", "A practical framework for defining the visual anchors, personality, and boundaries that make a character consistent.", "8 min read"],
  ["Plan a reference set before generating", "How to choose face, body, wardrobe, and expression references without creating a chaotic source library.", "6 min read"],
  ["From one image to a short campaign", "A small, repeatable workflow for turning a strong reference into a coherent set of posts and video tests.", "10 min read"],
];

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-[#070711] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#ffd0e7] hover:text-white"><ArrowLeft size={16} />Home</Link>
        <div className="mt-12 flex size-12 items-center justify-center rounded-md bg-[#8db7ff]/15 text-[#8db7ff]"><BookOpen /></div>
        <h1 className="mt-5 text-4xl font-semibold sm:text-6xl">Guides</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[#aeb4c6]">Human-written notes on making better personas and building a calmer creative workflow. These are mock article cards for now.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {guides.map(([title, summary, readTime]) => (
            <article key={title} className="flex min-h-64 flex-col rounded-lg border border-white/10 bg-white/[0.055] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#ff8fc7]">{readTime}</p>
              <h2 className="mt-4 text-xl font-semibold">{title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-[#b6bacb]">{summary}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">Coming soon <ArrowRight size={15} /></span>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
