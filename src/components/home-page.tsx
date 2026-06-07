import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Clapperboard,
  Database,
  ImageIcon,
  KeyRound,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";

const workflow = [
  {
    title: "Design the persona",
    copy: "Name the creator, capture the style direction, and collect identity references.",
    icon: UserRound,
  },
  {
    title: "Generate references",
    copy: "Create face, grid, body, and extra avatar shots from prompts or blended sources.",
    icon: WandSparkles,
  },
  {
    title: "Produce media",
    copy: "Turn the selected reference set into images, normal videos, or motion-control clips.",
    icon: Clapperboard,
  },
];

const providers = [
  "Gemini / Nano Banana Pro",
  "OpenAI image generation",
  "Wan 2.2 and Wan Animate",
  "Kling image-to-video",
  "Seedance 2.0",
];

const stats = [
  { label: "Reference slots", value: "4" },
  { label: "Provider families", value: "5" },
  { label: "Storage buckets", value: "4" },
];

export function HomePage({
  initialUserEmail,
  supabaseReady,
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#090c12] text-[#f7fbff]">
      <section className="relative min-h-[92vh] overflow-hidden border-b border-[#ffffff1a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(37,196,164,0.24),transparent_28%),radial-gradient(circle_at_78%_8%,rgba(247,170,66,0.18),transparent_24%),radial-gradient(circle_at_72%_72%,rgba(225,67,97,0.16),transparent_28%),linear-gradient(135deg,#090c12_0%,#111827_48%,#1b1718_100%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:46px_46px]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-[#25c4a4] text-[#07110f]">
              <Sparkles size={22} />
            </span>
            <span>
              <span className="block text-base font-semibold">Persona Studio</span>
              <span className="block text-xs font-medium uppercase tracking-[0.18em] text-[#aeb9c8]">
                Creator SaaS
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#c8d4e5] md:flex">
            <a href="#workflow" className="transition hover:text-white">
              Workflow
            </a>
            <a href="#stack" className="transition hover:text-white">
              Stack
            </a>
            <Link href="/studio" className="transition hover:text-white">
              Studio
            </Link>
          </nav>

          <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} />
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(92vh-5.5rem)] max-w-7xl items-center gap-10 px-5 pb-10 pt-4 sm:px-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,1fr)]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffffff24] bg-[#ffffff12] px-3 py-2 text-sm font-medium text-[#dce8f7]">
              <BadgeCheck size={16} className="text-[#25c4a4]" />
              Demo-safe AI creator production workspace
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Persona Studio
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c7d4e4]">
              A focused SaaS MVP for building AI-influencer identities, generating reusable reference avatars, and producing consistent images and videos from one workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#f7c95f] px-5 text-sm font-semibold text-[#151009] transition hover:bg-[#ffd979]"
              >
                Open studio
                <ArrowRight size={18} />
              </Link>
              <a
                href="#workflow"
                className="inline-flex h-12 items-center gap-2 rounded-md border border-[#ffffff2b] bg-[#ffffff10] px-5 text-sm font-semibold text-white transition hover:border-[#25c4a4]"
              >
                See workflow
                <Play size={17} />
              </a>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="border-l border-[#ffffff24] pl-4">
                  <p className="text-3xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[#9eacbd]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <HeroScene />
        </div>
      </section>

      <section id="workflow" className="bg-[#f6f2ea] px-5 py-16 text-[#151922] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b84f62]">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              From identity system to usable campaign media.
            </h2>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-[#ddd3c4] bg-[#fffaf0] p-5">
                  <div className="flex size-11 items-center justify-center rounded-md bg-[#25c4a4] text-[#07110f]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#52606f]">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="stack" className="bg-[#10151d] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#25c4a4]">Built for production paths</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Real adapters, typed requests, and database groundwork.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#bdc8d6]">
              The frontend is backed by Zod-validated API routes, a model registry, provider adapters, and a Supabase migration for user-owned personas, assets, jobs, provider configs, and credit accounting.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Feature icon={Boxes} title="Provider registry" copy="Model capabilities are declared in one place, then surfaced by the workspace controls." />
            <Feature icon={Database} title="Supabase schema" copy="Tables, storage buckets, and RLS policies are already laid out for persistence." />
            <Feature icon={KeyRound} title="Demo fallback" copy="Missing provider keys return demo output so the UI stays usable while integrating services." />
            <Feature icon={ShieldCheck} title="Rights checks" copy="Reference generation requires rights and adult-persona confirmations before calls are sent." />
          </div>
        </div>
      </section>

      <section className="bg-[#f6f2ea] px-5 py-14 text-[#151922] sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b84f62]">Providers</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {providers.map((provider) => (
                <span key={provider} className="rounded-md border border-[#ddd3c4] bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-[#334155]">
                  {provider}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/studio"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#151922] px-5 text-sm font-semibold text-white transition hover:bg-[#263244]"
          >
            Launch workspace
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function HeroScene() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-2xl">
      <div className="absolute inset-0 rounded-lg border border-[#ffffff26] bg-[#121923d9] shadow-2xl shadow-black/35" />
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between border-b border-[#ffffff17] pb-4">
        <div>
          <p className="text-sm font-semibold text-white">Live generation desk</p>
          <p className="mt-1 text-xs text-[#94a6bb]">Persona: Nova Vale</p>
        </div>
        <span className="rounded-md bg-[#25c4a4] px-3 py-1 text-xs font-semibold text-[#07110f]">Demo ready</span>
      </div>

      <div className="absolute bottom-5 left-5 top-24 w-[34%] rounded-md bg-[#0b1018] p-3">
        <div className="aspect-[4/5] rounded-md bg-[radial-gradient(circle_at_52%_32%,#f2c7a7_0_12%,#6d3f55_13%_23%,#e9a56f_24%_39%,#24384e_40%_100%)]" />
        <div className="mt-3 space-y-2">
          <div className="h-2 rounded-full bg-[#f7c95f]" />
          <div className="h-2 w-2/3 rounded-full bg-[#ffffff2b]" />
        </div>
      </div>

      <div className="absolute right-5 top-24 grid w-[56%] grid-cols-2 gap-3">
        <PreviewTile icon={UserRound} title="Face" accent="#25c4a4" />
        <PreviewTile icon={ImageIcon} title="Image" accent="#f7c95f" />
        <PreviewTile icon={Clapperboard} title="Video" accent="#e14361" />
        <PreviewTile icon={WandSparkles} title="Motion" accent="#8fd067" />
      </div>

      <div className="absolute bottom-5 right-5 w-[56%] rounded-md border border-[#ffffff14] bg-[#f6f2ea] p-4 text-[#151922]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Generation queue</p>
            <p className="mt-1 text-xs text-[#637083]">3 assets prepared</p>
          </div>
          <Sparkles size={20} className="text-[#b84f62]" />
        </div>
        <div className="mt-4 grid gap-2">
          <QueueBar label="Avatar" width="92%" color="#25c4a4" />
          <QueueBar label="Images" width="76%" color="#f7c95f" />
          <QueueBar label="Video" width="48%" color="#e14361" />
        </div>
      </div>
    </div>
  );
}

function PreviewTile({
  icon: Icon,
  title,
  accent,
}: {
  icon: typeof UserRound;
  title: string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-[#ffffff14] bg-[#ffffff0f] p-3">
      <Icon size={18} style={{ color: accent }} />
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 h-16 rounded-md" style={{ background: `linear-gradient(135deg, ${accent}, #ffffff18)` }} />
    </div>
  );
}

function QueueBar({ label, width, color }: { label: string; width: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-[#4b5563]">
        <span>{label}</span>
        <span>{width}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-[#d8d0c2]">
        <div className="h-full rounded-full" style={{ width, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Boxes;
  title: string;
  copy: string;
}) {
  return (
    <article className="rounded-lg border border-[#ffffff18] bg-[#ffffff0b] p-5">
      <Icon size={22} className="text-[#f7c95f]" />
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#b9c4d3]">{copy}</p>
    </article>
  );
}
