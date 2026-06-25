import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Clapperboard,
  Eye,
  FileText,
  Fingerprint,
  ImageIcon,
  Layers3,
  MessageSquareText,
  MousePointer2,
  PanelTop,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";

const features = [
  {
    title: "A clear starting point",
    copy: "Create a persona once, save the look and style, then build every new image or video from the same direction instead of starting over.",
    icon: Fingerprint,
  },
  {
    title: "Consistent 4K references",
    copy: "Make strong face, body, and style references that help your AI model stay recognizable across future content.",
    icon: Eye,
  },
  {
    title: "No hidden generation costs",
    copy: "See the token cost before you run a job, so you know what you are spending on tests, images, videos, speech, and avatar clips.",
    icon: CalendarCheck,
  },
  {
    title: "Guides that explain the business",
    copy: "Read practical lessons about setup, persona choices, traffic quality, tools, and what actually matters when building an AI OFM workflow.",
    icon: FileText,
  },
];

const steps = [
  {
    title: "Choose the persona",
    copy: "Give the model a name, a clear description, and a style direction. This becomes the base for every generation.",
  },
  {
    title: "Build reusable references",
    copy: "Generate or upload the key shots: face, body, outfit, and extra identity images. Save the best ones as your model's reference set.",
  },
  {
    title: "Turn references into content",
    copy: "Use the saved references to create images, videos, speech, and talking-avatar clips while keeping the cost visible.",
  },
];

const useCases = [
  {
    title: "New AI OFM builders",
    copy: "Start without buying an expensive course, researching every model yourself, or guessing which references you need first.",
    icon: Clapperboard,
  },
  {
    title: "Small creator teams",
    copy: "Keep the model's look, prompt direction, generated assets, and testing history in one place as you produce content.",
    icon: BriefcaseBusiness,
  },
  {
    title: "People tired of tool research",
    copy: "Use one guided workspace instead of jumping between model docs, random prompts, billing pages, and scattered file folders.",
    icon: UsersRound,
  },
];

const credibility = [
  "Guided studio workflow",
  "Human-written guides",
  "Transparent token balance",
  "Community chat coming soon",
];

export function HomePage({
  initialUserEmail,
  supabaseReady,
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070711] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(255,79,163,0.18),transparent_30%),radial-gradient(circle_at_78%_8%,rgba(116,92,246,0.18),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_42%,#160b1f_100%)]" />
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#080812]/[0.78] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md border border-[#ff4fa3]/40 bg-[#ff4fa3]/14 text-[#ff8fc7] shadow-[0_0_34px_rgba(255,79,163,0.18)]">
              <Sparkles size={19} />
            </span>
            <span className="text-base font-semibold tracking-normal">Persona Studio</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#aab0c2] md:flex">
            <a href="#features" className="transition hover:text-white">
              Benefits
            </a>
            <a href="#workflow" className="transition hover:text-white">
              Workflow
            </a>
            <a href="#preview" className="transition hover:text-white">
              Product
            </a>
            <Link href="/pricing" className="transition hover:text-white">
              Pricing
            </Link>
            <Link href="/guides" className="transition hover:text-white">
              Guides
            </Link>
            <Link href="/faq" className="transition hover:text-white">
              FAQ
            </Link>
            <Link href="/contact" className="transition hover:text-white">
              Contact us
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} variant="dark" />
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen max-w-7xl items-start justify-center px-5 pb-20 pt-32 text-center sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ff4fa3]/28 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-[#ffd0e7] shadow-[0_14px_45px_rgba(0,0,0,0.22)] backdrop-blur">
            <BadgeCheck size={16} className="text-[#ff65af]" />
            AI OFM tools, guides, and workflow in one place
          </div>

          <h1 className="mx-auto mt-7 text-5xl font-semibold leading-[1.01] tracking-normal text-white sm:text-7xl">
            Stop wasting time. Start building now.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#b6bacb]">
            Persona Studio helps you create a consistent AI model, generate reusable references, turn them into images and videos, and learn the workflow without paying for an overpriced course.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/studio"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#ff4fa3] px-5 text-sm font-semibold text-[#120913] shadow-[0_18px_44px_rgba(255,79,163,0.26)] transition hover:bg-[#ff77b8]"
            >
              Open the studio
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
            {credibility.map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 text-sm font-medium text-[#d9dce8]">
                <CheckCircle2 size={17} className="text-[#ff65af]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-white/10 bg-[#0b0b16]/[0.74] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">What You Get</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
                The tools and guidance to move from idea to usable content faster.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#aeb4c6]">
              Instead of selling theory only, Persona Studio gives you a working generation space plus clear lessons on setup, model choices, content strategy, and audience quality.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur"
                >
                  <div className="flex size-11 items-center justify-center rounded-md border border-[#ff4fa3]/24 bg-[#ff4fa3]/12 text-[#ff8fc7]">
                    <Icon size={21} />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#aeb4c6]">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              A simple path from blank idea to first production assets.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#aeb4c6]">
              You do not need to understand every AI model first. The studio gives you the steps, the right controls, and the saved history so each result teaches the next one.
            </p>
          </div>

          <div className="grid gap-4">
            {steps.map((step, index) => (
              <article key={step.title} className="grid gap-4 rounded-lg border border-white/10 bg-[#11111f]/[0.76] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:grid-cols-[56px_1fr]">
                <div className="flex size-14 items-center justify-center rounded-md border border-[#a78bfa]/30 bg-[#a78bfa]/12 text-lg font-semibold text-[#d7c8ff]">
                  0{index + 1}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#aeb4c6]">{step.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="border-y border-white/10 bg-[#0a0a14] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Product Preview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              A guided workspace for creating and reusing your AI model.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#aeb4c6]">
              Save the model, keep references visible, generate new content, and review costs without jumping between prompt documents, file folders, and billing pages.
            </p>
            <div className="mt-7 grid gap-3 text-sm text-[#d7dbea]">
              <PreviewPoint icon={Layers3} text="Save the face, body, and style references that define the persona." />
              <PreviewPoint icon={MessageSquareText} text="Keep prompts and generated results attached to the right model." />
              <PreviewPoint icon={ShieldCheck} text="Pay for studio access and generation tokens without inflated course pricing." />
            </div>
          </div>

          <WorkspacePreview />
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Who It Helps</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Built for people who want to create, test, and learn without wasting weeks.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-white/10 bg-white/[0.055] p-6 backdrop-blur">
                  <Icon size={24} className="text-[#8db7ff]" />
                  <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#aeb4c6]">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0d0d19] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Why It Exists</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Most people do not need another expensive course. They need a clear workflow.
            </h2>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <p className="text-xl leading-8 text-[#eef0f8]">
              &quot;The goal is simple: save the hours you would spend researching tools, testing random prompts, and buying overpriced lessons. Focus on building the model, learning what works, and producing content.&quot;
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <p className="font-semibold text-white">Persona Studio</p>
                <p className="mt-1 text-sm text-[#aeb4c6]">AI OFM education, generation tools, and practical workflow</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-[#ff4fa3]/24 bg-[#ff4fa3]/10 px-3 py-2 text-sm font-semibold text-[#ffd0e7]">
                <ShieldCheck size={16} />
                Built for practical builders
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function WorkspacePreview() {
  return (
    <div className="rounded-lg border border-white/[0.12] bg-[#10101d]/[0.86] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.36)] backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <aside className="rounded-lg border border-white/10 bg-[#080914] p-3">
          <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold text-white">
            <PanelTop size={17} className="text-[#ff77b8]" />
            Studio
          </div>
          {["Personas", "Images", "Videos", "Assets"].map((item, index) => (
            <div
              key={item}
              className={`mb-2 flex h-10 items-center gap-2 rounded-md px-3 text-sm ${
                index === 1
                  ? "border border-[#ff4fa3]/32 bg-[#ff4fa3]/[0.13] text-white"
                  : "text-[#9fa6b8]"
              }`}
            >
              {index === 1 ? <ImageIcon size={16} /> : <MousePointer2 size={16} />}
              {item}
            </div>
          ))}
        </aside>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.78fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
              <p className="text-sm font-semibold text-white">Persona brief</p>
              <div className="mt-4 grid gap-3">
                <BriefRow label="Persona" value="Mira Vale, AI creator model" />
                <BriefRow label="Goal" value="Reusable references and first content set" />
                <BriefRow label="Style" value="Consistent face, outfit, and realistic lighting" />
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0b1020] p-4">
              <p className="text-sm font-semibold text-white">Selected references</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ReferenceCard label="Primary" active />
                <ReferenceCard label="Wardrobe" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Output review</p>
                <p className="mt-1 text-xs text-[#9fa6b8]">Choose the strongest result and reuse it next time.</p>
              </div>
              <span className="rounded-md border border-[#8db7ff]/25 bg-[#8db7ff]/10 px-3 py-1.5 text-xs font-semibold text-[#cfe0ff]">
                Cost shown first
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <PreviewFrame tone="bg-[#241829]" />
              <PreviewFrame tone="bg-[#151d31]" selected />
              <PreviewFrame tone="bg-[#1e1727]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPoint({ icon: Icon, text }: { icon: typeof Layers3; text: string }) {
  return (
    <div className="flex gap-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-[#ff77b8]" />
      <span>{text}</span>
    </div>
  );
}

function ReferenceCard({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${active ? "border-[#ff4fa3]/[0.45] bg-[#ff4fa3]/[0.12]" : "border-white/10 bg-white/[0.045]"}`}>
      <div className="aspect-square rounded bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))]" />
      <p className="mt-2 text-[11px] font-medium text-[#b9bfd0]">{label}</p>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#070812]/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8f96aa]">{label}</p>
      <p className="mt-1 text-sm text-[#e5e7f0]">{value}</p>
    </div>
  );
}

function PreviewFrame({ tone, selected = false }: { tone: string; selected?: boolean }) {
  return (
    <div className={`aspect-[4/5] rounded-md border ${selected ? "border-[#ff4fa3]/[0.55]" : "border-white/10"} ${tone} p-2`}>
      <div className="h-3/5 rounded bg-white/[0.08]" />
      <div className="mt-3 h-2 rounded bg-white/[0.15]" />
      <div className={`mt-2 h-2 w-2/3 rounded ${selected ? "bg-[#ff4fa3]/[0.58]" : "bg-white/10"}`} />
    </div>
  );
}
