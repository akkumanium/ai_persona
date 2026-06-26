"use client";

import Link from "next/link";
import Image from "next/image";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { useEffect } from "react";
import { AuthButton } from "@/components/auth/auth-button";

const homeSans = Inter({
  subsets: ["latin"],
  variable: "--font-home-sans",
  display: "swap",
});

const homeSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-home-serif",
  display: "swap",
});

const homeMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-home-mono",
  display: "swap",
});

const marqueeItems = [
  "4K stills",
  "Talking avatar",
  "Voice clone",
  "Wardrobe ref",
  "Body ref",
  "Face ref",
  "4-second video",
  "Outfit variations",
  "Lighting tests",
  "Pose sheet",
];

const referenceImages = [
  ["lock-ref-face", "Primary face reference"],
  ["lock-ref-body", "Body reference"],
  ["lock-ref-outfit", "Outfit reference"],
  ["lock-ref-identity", "Identity reference"],
];

const outputImages = ["gen-out-1", "gen-out-2", "gen-out-3", "gen-out-4"];
const workspaceReferences = [
  ["ws-ref-face", "Face"],
  ["ws-ref-body", "Body"],
  ["ws-ref-outfit", "Outfit"],
  ["ws-ref-identity", "ID"],
];
const workspaceOutputs = ["ws-out-1", "ws-out-2", "ws-out-3", "ws-out-4"];

export function HomePage({
  initialUserEmail,
  supabaseReady,
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
}) {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const heroVisual = document.getElementById("homeHeroVisual");
    const cards = heroVisual?.querySelectorAll<HTMLElement>("[data-depth]") ?? [];

    if (!heroVisual || !cards.length || reduceMotion || isTouch) return;

    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let running = true;
    let animationFrame = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = heroVisual.getBoundingClientRect();
      mx = (event.clientX - rect.left) / rect.width - 0.5;
      my = (event.clientY - rect.top) / rect.height - 0.5;
    };

    const handleMouseLeave = () => {
      mx = 0;
      my = 0;
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        running = entry.isIntersecting;
      });
    });

    const tick = () => {
      if (running) {
        tx += (mx - tx) * 0.08;
        ty += (my - ty) * 0.08;

        cards.forEach((card) => {
          const depth = Number(card.dataset.depth ?? "0");
          const base = card.dataset.base ?? "";
          const dx = tx * 30 * depth;
          const dy = ty * 30 * depth;
          const rx = -ty * 6 * depth;
          const ry = tx * 10 * depth;

          card.style.transform = `${base} translate3d(${dx}px, ${dy}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
      }

      animationFrame = requestAnimationFrame(tick);
    };

    heroVisual.addEventListener("mousemove", handleMouseMove);
    heroVisual.addEventListener("mouseleave", handleMouseLeave);
    observer.observe(heroVisual);
    tick();

    return () => {
      heroVisual.removeEventListener("mousemove", handleMouseMove);
      heroVisual.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <main className={`${homeSans.variable} ${homeSerif.variable} ${homeMono.variable} new-home`}>
      <div className="home-noise" />

      <nav className="nav" aria-label="Primary navigation">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" />
            <span>persona/studio</span>
          </Link>
          <div className="nav-links">
            <a href="#workflow">Workflow</a>
            <a href="#studio">Studio</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="nav-actions">
            <AuthButton initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} variant="dark" />
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div className="hero-text">
            <div className="hero-eyebrow">
              <span className="dot" />
              AI OFM studio / v1.0
            </div>
            <h1>
              One face.
              <br />
              <em>Every output.</em>
            </h1>
            <p className="lead">
              Persona Studio is a working space for AI creator models. Save the face, the body, the style, then generate
              images, video, speech, and avatar clips that all look unmistakably like the same person.
            </p>
            <div className="hero-cta-row">
              <Link href="/studio" className="btn-primary">
                Open the studio <span>-&gt;</span>
              </Link>
              <a href="#workflow" className="btn-text">
                See the workflow
              </a>
            </div>
            <div className="hero-foot">
              <span>
                <span className="check-mini" /> No hidden generation costs
              </span>
              <span>
                <span className="check-mini" /> Cancel anytime
              </span>
              <span>
                <span className="check-mini" /> Human-written guides
              </span>
            </div>
          </div>

          <div className="hero-visual" id="homeHeroVisual">
            <div className="hero-glyph">01</div>
            <div className="card-stack">
              <HeroCard
                className="card-back-3"
                depth="0.25"
                base="translate(-50%, -50%) rotate(14deg)"
                image="mira-body-ref"
                size="300/400"
                label="Body ref"
              />
              <HeroCard
                className="card-back-2"
                depth="0.4"
                base="translate(-50%, -50%) rotate(-10deg)"
                image="mira-wardrobe-still"
                size="300/400"
                label="Wardrobe"
              />
              <HeroCard
                className="card-back-1"
                depth="0.6"
                base="translate(-50%, -50%) rotate(8deg)"
                image="mira-video-frame-04"
                size="300/400"
                label="Video / 04s"
              />
              <div className="card card-front" data-depth="1.0" data-base="translate(-50%, -50%)">
                <Image
                  src="https://picsum.photos/seed/mira-vale-portrait-primary/600/800"
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 960px) 240px, 290px"
                />
                <div className="card-meta">
                  <span className="card-name">Mira Vale</span>
                  <span className="card-tag">Primary</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <section className="shift">
        <div className="container shift-inner">
          <div>
            <div className="shift-num">
              <span>01</span> / The shift
            </div>
          </div>
          <div className="shift-body">
            <h2>
              Most people do not need another <em>expensive course</em>. They need a workflow that actually runs.
            </h2>
            <p>
              There is a folder of bookmarks. Three billing dashboards. A desktop covered in final_v3.png. A notes app
              full of prompts that worked once and never again. And somewhere under all of it, the actual goal: a
              consistent AI creator model that produces content people pay for.
            </p>
            <p>
              The courses teach the theory. The tools bill by the token. Nobody gives you the workspace where the model,
              the references, the prompts, and the outputs all live together, so you can stop researching and start
              shipping.
            </p>
            <div className="pullquote">The model is the asset. Everything else is friction.</div>
            <p>Persona Studio is that workspace. Built around one persona, not ten tools.</p>
          </div>
        </div>
      </section>

      <section className="how" id="workflow">
        <div className="container">
          <div className="how-head">
            <span className="eyebrow">02 / The workflow</span>
            <h2>
              Three steps. <em>One persona.</em> Every output traces back to the same face.
            </h2>
          </div>
          <div className="how-grid">
            <div className="how-left">
              <p>
                You do not need to understand every AI model before you start. The studio gives you the steps, the right
                controls, and the saved history, so each result teaches the next one.
              </p>
              <p className="mt-20">By step three, you are not testing anymore. You are producing.</p>
            </div>
            <div className="how-steps">
              <WorkflowStep
                number="01"
                title="Define the persona"
                copy="Name, description, style direction. This is the base every future generation inherits from, not a prompt you rewrite each time, but a saved identity."
              >
                <div className="mini-brief">
                  <MiniRow label="Name" value="Mira Vale" />
                  <MiniRow label="Style" value="Warm editorial, late-afternoon light" />
                  <MiniRow label="Voice" value="Calm, low register, slight rasp" />
                </div>
              </WorkflowStep>

              <WorkflowStep
                number="02"
                title="Lock the references"
                copy="Generate or upload the key shots: face, body, outfit, identity images. Save the keepers as the model's permanent reference set. Every future job pulls from these."
              >
                <div className="mini-refs">
                  {referenceImages.map(([seed, alt], index) => (
                    <div key={seed} className={`mini-ref ${index === 0 ? "primary" : ""}`}>
                      <PicsumImage seed={seed} width={200} height={200} alt={alt} sizes="(max-width: 640px) 45vw, 120px" />
                    </div>
                  ))}
                </div>
              </WorkflowStep>

              <WorkflowStep
                number="03"
                title="Generate without drift"
                copy="Spin out images, video, speech, and avatar clips from the saved references. Cost is shown before every run. The strongest results get folded back into the reference set."
              >
                <div className="mini-output">
                  {outputImages.map((seed, index) => (
                    <div key={seed} className={`mini-out-tile ${index === 1 ? "selected" : ""}`}>
                      <PicsumImage seed={seed} width={200} height={260} sizes="(max-width: 640px) 45vw, 120px" />
                    </div>
                  ))}
                </div>
                <div className="mini-cost">120 tokens / shown before run</div>
              </WorkflowStep>
            </div>
          </div>
        </div>
      </section>

      <section className="preview" id="studio">
        <div className="container">
          <div className="preview-head">
            <span className="eyebrow">03 / Inside the studio</span>
            <h2>
              A workspace built around <em>one model</em>, not ten tools.
            </h2>
            <p>
              Save the model. Keep the references visible. Generate, review, and reuse without jumping between prompt
              docs, file folders, and billing pages.
            </p>
          </div>

          <div className="workspace">
            <div className="workspace-bar">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <div className="url">studio.personastudio.app / mira-vale</div>
              <div className="balance">12,840 tokens</div>
            </div>
            <div className="workspace-body">
              <aside className="workspace-side">
                <WorkspaceSection title="Workspace" items={["Personas", "Images", "Videos", "Speech", "Avatars"]} />
                <WorkspaceSection title="Library" items={["Assets", "Prompts", "History"]} />
                <WorkspaceSection title="Learn" items={["Guides", "Playbooks"]} />
              </aside>
              <div className="ws-main">
                <div className="ws-header">
                  <div>
                    <div className="ws-title">
                      Mira <em>Vale</em>
                    </div>
                    <div className="ws-meta">created 2024.11 / 47 assets / 8 saved references</div>
                  </div>
                  <button className="ws-generate" type="button">
                    + New generation
                  </button>
                </div>
                <div className="ws-grid">
                  <div className="ws-card">
                    <h4>Persona brief</h4>
                    <BriefRow label="Name" value="Mira Vale" />
                    <BriefRow label="Goal" value="Reusable refs, first content set" />
                    <BriefRow label="Style" value="Warm editorial, realistic light" />
                    <BriefRow label="Voice" value="Calm, low, slight rasp" />
                    <BriefRow label="Body" value={`5'6", athletic, dark hair`} />
                  </div>
                  <div className="ws-card">
                    <h4>Reference set</h4>
                    <div className="ref-grid">
                      {workspaceReferences.map(([seed, label], index) => (
                        <div key={seed} className={`ref-tile ${index === 0 ? "primary" : ""}`}>
                          <PicsumImage seed={seed} width={200} height={200} sizes="(max-width: 700px) 42vw, 180px" />
                          <span className="tag">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="output-section">
                  <div className="output-head">
                    <h4>Output review / batch 04</h4>
                    <div className="cost-pill">480 tokens / before run</div>
                  </div>
                  <div className="output-grid">
                    {workspaceOutputs.map((seed, index) => (
                      <div key={seed} className={`output-tile ${index === 1 ? "selected" : ""}`}>
                        <PicsumImage seed={seed} width={300} height={400} sizes="(max-width: 700px) 42vw, 220px" />
                        {index === 1 ? <span className="check">OK</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tokens" id="tokens">
        <div className="container tokens-inner">
          <div>
            <span className="eyebrow">04 / Token transparency</span>
            <h2>
              You see the cost <em>before</em> you run the job. Never after.
            </h2>
            <p>
              No hidden generation fees. No surprise billing at the end of the month. Studio access is one flat price.
              Generation tokens are pay-as-you-go, always visible, always shown before you commit to a run.
            </p>
            <p className="mt-16">
              Run a test image for 120 tokens. A 4-second video for 880. Bail on a batch if the math stops working. The
              meter is yours.
            </p>
          </div>
          <div className="meter-card">
            <MeterRow label="4K still image" cost="120" width="14%" />
            <MeterRow label="4-second video clip" cost="880" width="68%" />
            <MeterRow label="Voice clone / 30s" cost="200" width="22%" />
            <MeterRow label="Talking avatar / 15s" cost="640" width="52%" />
            <div className="meter-total">
              <div>
                <div className="label">Balance</div>
                <div className="value">
                  12,840 <em>tokens</em>
                </div>
              </div>
              <Link href="/pricing" className="btn-secondary">
                Top up
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="audience">
        <div className="container">
          <div className="audience-head">
            <span className="eyebrow">05 / Who it is for</span>
            <h2>
              Three people who keep <em>losing weeks</em> to the wrong stage.
            </h2>
          </div>
          <div className="audience-list">
            <AudienceItem
              number="A / For the new builder"
              title={
                <>
                  Start without the <em>$1,200 course</em>.
                </>
              }
              copy="Without a folder of bookmarks. Without guessing which reference matters first. The studio gives you the order, the tools, and the lessons, so the first week produces assets, not research."
            />
            <AudienceItem
              number="B / For the small team"
              title={
                <>
                  One model, <em>shared context</em>.
                </>
              }
              copy='Keep the look, the prompts, the generated assets, and the testing history in one workspace. Everyone generates from the same reference set. No more "which Mira is this?"'
            />
            <AudienceItem
              number="C / For the tool-fatigued"
              title={
                <>
                  One workspace, <em>not fifteen tabs</em>.
                </>
              }
              copy='Three billing pages, two model docs, a Discord, a notes app, and a desktop full of "final_v3.png". Persona Studio replaces all of it with one guided surface.'
            />
          </div>
        </div>
      </section>

      <section className="closing" id="closing">
        <div className="container closing-inner">
          <span className="eyebrow">06 / Why this exists</span>
          <blockquote>
            Save the hours you would spend researching tools, testing random prompts, and buying overpriced lessons.{" "}
            <em>Build the model. Learn what works. Ship the content.</em>
          </blockquote>
          <cite>- Persona Studio / built for practical builders</cite>
          <div className="closing-cta">
            <Link href="/studio" className="btn-primary">
              Open the studio <span>-&gt;</span>
            </Link>
            <Link href="/guides" className="btn-text">
              or read the guides first
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>(c) Persona Studio / 2026</div>
          <div className="footer-links">
            <Link href="/studio">Studio</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>v1.0 / all systems operational</div>
        </div>
      </footer>
    </main>
  );
}

function HeroCard({
  className,
  depth,
  base,
  image,
  size,
  label,
}: {
  className: string;
  depth: string;
  base: string;
  image: string;
  size: string;
  label: string;
}) {
  return (
    <div className={`card ${className}`} data-depth={depth} data-base={base}>
      <Image
        src={`https://picsum.photos/seed/${image}/${size}`}
        alt=""
        fill
        unoptimized
        sizes="(max-width: 960px) 180px, 220px"
      />
      <div className="card-label">{label}</div>
    </div>
  );
}

function PicsumImage({
  seed,
  width,
  height,
  alt = "",
  sizes,
}: {
  seed: string;
  width: number;
  height: number;
  alt?: string;
  sizes: string;
}) {
  return (
    <Image
      src={`https://picsum.photos/seed/${seed}/${width}/${height}`}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
    />
  );
}

function WorkflowStep({
  number,
  title,
  copy,
  children,
}: {
  number: string;
  title: string;
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="step">
      <div className="step-num">{number}</div>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
        <div className="step-visual">{children}</div>
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkspaceSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="ws-section">
      <div className="ws-label">{title}</div>
      {items.map((item) => (
        <div key={item} className={`ws-item ${item === "Images" ? "active" : ""}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="brief-row">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

function MeterRow({ label, cost, width }: { label: string; cost: string; width: string }) {
  return (
    <div className="meter-row">
      <div>
        <div className="meter-label">{label}</div>
        <div className="meter-bar">
          <div style={{ width }} />
        </div>
      </div>
      <div className="meter-cost">{cost}</div>
    </div>
  );
}

function AudienceItem({ number, title, copy }: { number: string; title: React.ReactNode; copy: string }) {
  return (
    <div className="audience-item">
      <div className="audience-num">{number}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}
