import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
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
    title: "Stable character direction",
    copy: "Store the persona's look, voice, references, and usage notes together so every new asset starts from the same creative brief.",
    icon: Fingerprint,
  },
  {
    title: "Reference-aware generation",
    copy: "Choose the exact images that should guide a render. The workspace keeps those references visible instead of hiding them in a prompt history.",
    icon: Eye,
  },
  {
    title: "Spend visibility before output",
    copy: "See the balance impact of image and video jobs as you work, making it easier to plan tests without losing track of cost.",
    icon: CalendarCheck,
  },
  {
    title: "Reviewable production history",
    copy: "Generated assets, prompts, providers, and job states stay attached to the persona so teams can compare what worked.",
    icon: FileText,
  },
];

const steps = [
  {
    title: "Define the identity",
    copy: "Capture the persona's purpose, visual boundaries, styling notes, and reusable reference needs.",
  },
  {
    title: "Generate with context",
    copy: "Select references, choose image or video output, and keep every job tied to the right identity.",
  },
  {
    title: "Reuse the best results",
    copy: "Promote strong outputs into your reference set and build the next batch from evidence, not guesswork.",
  },
];

const useCases = [
  {
    title: "Creator teams",
    copy: "Keep recurring faces, outfits, campaign themes, and approved references organized across short-form content cycles.",
    icon: Clapperboard,
  },
  {
    title: "Brand studios",
    copy: "Prototype talent concepts, product scenes, and launch visuals while maintaining clear review notes for stakeholders.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Small businesses",
    copy: "Create consistent social assets for offers, seasonal campaigns, and audience tests without rebuilding style direction each week.",
    icon: UsersRound,
  },
];

const credibility = [
  "Reference-first workflow",
  "Secure account access",
  "Clear token balance",
  "Image and video jobs",
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
          </nav>

          <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} variant="dark" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen max-w-7xl items-start justify-center px-5 pb-20 pt-32 text-center sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ff4fa3]/28 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-[#ffd0e7] shadow-[0_14px_45px_rgba(0,0,0,0.22)] backdrop-blur">
            <BadgeCheck size={16} className="text-[#ff65af]" />
            Persona production for careful creative teams
          </div>

          <h1 className="mx-auto mt-7 text-5xl font-semibold leading-[1.01] tracking-normal text-white sm:text-7xl">
            Build AI personas that stay consistent under real production pressure.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#b6bacb]">
            Persona Studio gives teams one elegant place to define a reusable creator identity, manage reference assets, and produce image or video variations with the context intact.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/studio"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#ff4fa3] px-5 text-sm font-semibold text-[#120913] shadow-[0_18px_44px_rgba(255,79,163,0.26)] transition hover:bg-[#ff77b8]"
            >
              Open studio
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-white/[0.14] bg-white/[0.08] px-5 text-sm font-semibold text-white transition hover:border-[#ff4fa3]/70 hover:bg-white/[0.12]"
            >
              View pricing
              <ChevronRight size={18} />
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Practical Benefits</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
                Less drift, clearer decisions, faster asset review.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-[#aeb4c6]">
              The product is built around the parts of AI production that usually become messy: references, revisions, token spend, and shared memory.
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
              A simple loop for keeping creative direction honest.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#aeb4c6]">
              Persona Studio keeps planning, generation, and review close together so each pass improves the system instead of becoming another loose file.
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
              A workspace built for reference-led AI production.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#aeb4c6]">
              Compare persona notes, selected references, output state, and token cost without jumping between prompt documents, file folders, and billing pages.
            </p>
            <div className="mt-7 grid gap-3 text-sm text-[#d7dbea]">
              <PreviewPoint icon={Layers3} text="Reference slots make intent visible before generation starts." />
              <PreviewPoint icon={MessageSquareText} text="Prompts remain attached to the resulting asset for later review." />
              <PreviewPoint icon={ShieldCheck} text="Account access and credits are handled before the studio opens." />
            </div>
          </div>

          <WorkspacePreview />
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Use Cases</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Useful when consistency is part of the brief.
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#ff77b8]">Credibility</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Calm enough for daily work. Precise enough for client review.
            </h2>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <p className="text-xl leading-8 text-[#eef0f8]">
              &quot;The value is not another prompt box. It is the shared record: who the persona is, which references are approved, what each job cost in tokens, and which outputs are worth repeating.&quot;
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <p className="font-semibold text-white">Creative operations lead</p>
                <p className="mt-1 text-sm text-[#aeb4c6]">Reviewing AI creator workflows for brand teams</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-[#ff4fa3]/24 bg-[#ff4fa3]/10 px-3 py-2 text-sm font-semibold text-[#ffd0e7]">
                <ShieldCheck size={16} />
                Built for accountable production
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
              <p className="text-sm font-semibold text-white">Generation brief</p>
              <div className="mt-4 grid gap-3">
                <BriefRow label="Persona" value="Mira Vale, editorial founder" />
                <BriefRow label="Output" value="Vertical product stills" />
                <BriefRow label="Guardrail" value="Keep facial structure and soft studio lighting" />
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
                <p className="mt-1 text-xs text-[#9fa6b8]">Compare the newest set before saving references.</p>
              </div>
              <span className="rounded-md border border-[#8db7ff]/25 bg-[#8db7ff]/10 px-3 py-1.5 text-xs font-semibold text-[#cfe0ff]">
                2 min remaining
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
