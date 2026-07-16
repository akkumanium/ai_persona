"use client";

import Link from "next/link";
import Image from "next/image";
import { Inter, Space_Grotesk } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";

const homeSans = Inter({
  subsets: ["latin"],
  variable: "--font-home-sans",
  display: "swap",
});

const homeDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-home-serif",
  display: "swap",
});

const marqueeItems = [
  "Nano Banana Pro",
  "Kling 3.0",
  "Seedance 2.0",
  "Natural voice",
  "Talking avatar",
  "Guides",
  "Same body",
  "Same voice",
  "Every platform",
  "Motion control",
];

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
    <main className={`${homeSans.variable} ${homeDisplay.variable} new-home`}>
      <style>{`
        /* ── Scroll reveal ── */
        .reveal {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }

        /* ── Heading font override (Space Grotesk) ── */
        .new-home h1,
        .new-home h2,
        .new-home h3,
        .new-home h4 {
          font-family: var(--font-home-sans), system-ui, sans-serif !important;
          letter-spacing: -0.05em;
        }

        .new-home h1 em,
        .new-home h2 em,
        .new-home h3 em {
          font-style: normal;
          font-weight: inherit;
        }

        .new-home h1 {
          font-weight: 800;
          line-height: 0.95;
          font-size: clamp(3rem, 7vw, 6rem) !important;   /* ← add this */
        }

        .new-home h2 {
          font-weight: 800;
          line-height: 1;
          font-size: clamp(2rem, 4vw, 3.5rem); /* ← add this */
        }

        .new-home h3,
        .new-home h4 {
          font-weight: 700;
        }

        /* ── Hero card entrance ── */
        .card-stack .card {
          animation: heroFadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
        .card-stack .card-back-3 { animation-delay: 0.15s; }
        .card-stack .card-back-2 { animation-delay: 0.30s; }
        .card-stack .card-back-1 { animation-delay: 0.45s; }
        .card-stack .card-front  { animation-delay: 0.60s; }
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Engine steps ── */
        .engine-steps {
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          margin-top: 2rem;
        }
        .engine-step {
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
        }
        .engine-step-num {
          font-family: var(--font-home-serif), system-ui, sans-serif;
          font-size: 0.875rem;
          font-weight: 600;
          opacity: 0.35;
          min-width: 2.25rem;
          padding-top: 0.1rem;
        }
        .engine-step-body h4 {
          font-size: 1.05rem;
          margin: 0 0 0.4rem;
        }
        .engine-step-body p {
          font-size: 0.9rem;
          line-height: 1.6;
          opacity: 0.65;
          margin: 0;
        }

        /* ── Why-us section ── */
        .why-us {
          padding: 7rem 0;
        }
        .why-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-top: 3.5rem;
        }
        @media (max-width: 768px) {
          .why-grid-3 { grid-template-columns: 1fr; }
        }
        .why-box {
          padding: 2.25rem 1.75rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          transition: border-color 0.35s ease, background 0.35s ease, transform 0.35s ease;
        }
        .why-box:hover {
          border-color: rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.04);
          transform: translateY(-3px);
        }
        .why-box-num {
          font-family: var(--font-home-serif), system-ui, sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.4;
          margin-bottom: 1rem;
        }
        .why-box h3 {
          font-size: 1.2rem;
          margin: 0 0 0.65rem;
        }
        .why-box p {
          font-size: 0.875rem;
          line-height: 1.65;
          opacity: 0.6;
          margin: 0;
        }

        /* ── Guides section ── */
        .guides-section {
          padding: 7rem 0;
        }
        .guide-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.875rem;
          margin-top: 2.75rem;
          max-width: 720px;
          margin-left: auto;
          margin-right: auto;
        }
        @media (max-width: 640px) {
          .guide-list { grid-template-columns: 1fr; }
        }
        .guide-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.15rem 1.4rem;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          font-size: 0.9rem;
          transition: border-color 0.3s ease, transform 0.3s ease;
        }
        .guide-item:hover {
          border-color: rgba(255,255,255,0.16);
          transform: translateX(5px);
        }
        .guide-item-arrow {
          opacity: 0.4;
          font-family: var(--font-home-sans), system-ui, sans-serif;
        }

        /* ── Section head ── */
        .section-head {
          text-align: center;
        }
        .section-head h2 {
          margin: 1.1rem 0 0;
        }
        .section-head > p {
          margin: 1.15rem auto 0;
          font-size: 1rem;
          opacity: 0.55;
          max-width: 560px;
          line-height: 1.6;
        }

        /* ── Closing ── */
        .closing-body {
          font-size: 1.05rem;
          line-height: 1.65;
          opacity: 0.6;
          max-width: 580px;
          margin: 1.5rem auto 0;
        }

        /* ── Paragraph em in body copy stays italic ── */
        .how-left p em,
        .shift-body p em {
          font-style: italic;
          font-weight: inherit;
        }
      `}</style>

      <div className="home-noise" />

      {/* ── Nav ── */}
      <PublicHeader initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div className="hero-text">
            <Reveal>
              <div className="hero-eyebrow">
                <span className="dot" />
                AI Idolborn
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1>
                Launch your AI influencer
                <em>today.</em>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lead">
                Idolborn is the only workspace you need to build a consistent
                AI model and ship images, video, and voice that all look like the same person — every time. 
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero-cta-row">
                <Link href="/studio" className="btn-primary">
                  Start generating <span>&rarr;</span>
                </Link>
                <a href="#engine" className="btn-text">
                  See how it works
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="hero-foot">
                <span>
                  <span className="check-mini" /> Top AI models
                </span>
                <span>
                  <span className="check-mini" /> Best consistency
                </span>
                <span>
                  <span className="check-mini" /> No 6-hour tutorial required
                </span>
              </div>
            </Reveal>
          </div>

          <div className="hero-visual" id="homeHeroVisual">
            <div className="hero-glyph">01</div>
            <div className="card-stack">
              <HeroCard
                className="card-back-3"
                depth="0.25"
                base="translate(-50%, -50%) rotate(14deg)"
                image="/home/persona-body-ref.webp"
                label="Outside"
              />
              <HeroCard
                className="card-back-2"
                depth="0.4"
                base="translate(-50%, -50%) rotate(-10deg)"
                image="/home/persona-wardrobe.webp"
                label="Gym"
              />
              <HeroCard
                className="card-back-1"
                depth="0.6"
                base="translate(-50%, -50%) rotate(8deg)"
                image="/home/persona-video-frame.webp"
                label="Video / 04s"
              />
              <div className="card card-front" data-depth="1.0" data-base="translate(-50%, -50%)">
                <Image
                  src="/home/persona-primary.webp"
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 960px) 240px, 290px"
                />
                <div className="card-meta">
                  <span className="card-name">Jessica</span>
                  <span className="card-tag">Reference</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      {/* ── 01 — The Problem ── */}
      <section className="shift" id="problem">
        <div className="container shift-inner">
          <Reveal>
            <div>
              <div className="shift-num">
                <span>01</span> / Why this exists
              </div>
            </div>
          </Reveal>
          <div className="shift-body">
            <Reveal delay={100}>
              <h2>
                No more googling and trying. Start shipping <em>now</em>.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p>
                You buy a course, watch 6 hours of theory, open four different tools,
                fight with three different billing dashboards, and three weeks later you&apos;re
                left confused and still haven&apos;t created a single video. We solved this problem.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="pullquote">
                Time is your most valuable currency. We took care of tools and research, so you can focus on making money.
              </div>
            </Reveal>
            <Reveal delay={400}>
              <p>
                Idolborn replaces the course, the bookmarks, and the five tabs with one workspace. Define your
                model once. Generate from it forever.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 02 — The Persona Engine ── */}
      <section className="how" id="engine">
        <div className="container">
          <Reveal>
            <div className="how-head">
              <span className="eyebrow">02 / Face consistency</span>
              <h2>
                The same face. 
                <br></br>
                <em>Every time.</em>
              </h2>
            </div>
          </Reveal>
          <div className="how-grid">
            <Reveal delay={120}>
              <div className="how-left">
                <p>
                  Most AI tools don&apos;t teach you how to keep face consistent every generation. That&apos;s fine for a one-time usage, useless for social media business.
                  Idolborn locks your face, body, and style into a saved reference set — every image,
                  video, and voice clip generates <em>from</em> that set, not from scratch.
                </p>
                <p className="mt-20">No LoRA or ComfyUI needed.</p>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="engine-steps">
                <EngineStep
                  num="01"
                  title="Define it once"
                  copy="Name, look, voice, style direction — set once, saved forever."
                />
                <EngineStep
                  num="02"
                  title="Lock the references"
                  copy="Face, body, outfit, identity shots become the permanent source of truth."
                />
                <EngineStep
                  num="03"
                  title="Generate from it"
                  copy="Every new asset inherits the same identity instead of reinventing it."
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 03 — Why Idolbor ── */}
      <section className="why-us" id="why-us">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">03 / Beyond the basics</span>
              <h2>
                Beyond <em>the basics</em>
              </h2>
              <p>Three things that make it easier to win.</p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="why-grid-3">
              <div className="why-box">
                <div className="why-box-num">01</div>
                <h3>Top-tier models</h3>
                <p>
                  We route every generation through top-tier image, video, and voice models — not a cheap backend
                  swapped in to pad margins. Better model ships, we plug it in. Your model only gets better tools
                  pointed at it.
                </p>
              </div>
              <div className="why-box">
                <div className="why-box-num">02</div>
                <h3>Community</h3>
                <p>
                  Compare what&apos;s converting, what stopped working last week,
                  and which platform just changed its rules — with people actually doing this.
                </p>
              </div>
              <div className="why-box">
                <div className="why-box-num">03</div>
                <h3>Stay up to date</h3>
                <p>
                  AI models change monthly. Platform rules change weekly. Guides get
                  rewritten the moment a platform changes detection. You&apos;re not buying a snapshot of last year&apos;s best
                  practices.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 04 — Guides ── */}
      <section className="guides-section" id="guides">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">04 / Guides</span>
              <h2>
                Nobody tells you the part that <em>actually gets you banned</em>.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p
              style={{
                textAlign: "center",
                maxWidth: 620,
                margin: "1.25rem auto 0",
                opacity: 0.6,
                lineHeight: 1.6,
              }}
            >
              Learn how to set up accounts that survive, how
              to warm up a new profile without tripping every spam filter, or how platforms actually detect AI content
              creators. We provide written guides, updated as platforms change their rules.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="guide-list">
              <div className="guide-item">
                <span className="guide-item-arrow">&rarr;</span>
                Account setup &amp; platform compliance
              </div>
              <div className="guide-item">
                <span className="guide-item-arrow">&rarr;</span>
                Warm-up for new profiles
              </div>
              <div className="guide-item">
                <span className="guide-item-arrow">&rarr;</span>
                Avoiding common shadowban triggers
              </div>
              <div className="guide-item">
                <span className="guide-item-arrow">&rarr;</span>
                Platform-by-platform content policies
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="closing" id="closing">
        <div className="container closing-inner">
          <Reveal>
            <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.1 }}>
              Stop researching. <em>Start generating.</em>
            </h2>
          </Reveal>
          <br></br>
          <Reveal delay={120}>
            <p className="closing-body">
              You already lost time researching tools, watching tutorials, and trying unknown workflows. That part&apos;s over.
              Define your model, lock the references, and ship your first video in the next ten minutes.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="closing-cta">
              <Link href="/studio" className="btn-primary">
                Start generating <span>&rarr;</span>
              </Link>
              <Link href="/studio" className="btn-text">
                or explore the studio
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container footer-inner">
          <div>(c) Idolborn / 2026</div>
          <div className="footer-links">
            <Link href="/studio">Studio</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ──────────────────────────── Helpers ──────────────────────────── */

/* Scroll-triggered reveal wrapper */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const animationFrame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Hero parallax card */
function HeroCard({
  className,
  depth,
  base,
  image,
  label,
}: {
  className: string;
  depth: string;
  base: string;
  image: string;
  label: string;
}) {
  return (
    <div className={`card ${className}`} data-depth={depth} data-base={base}>
      <Image
        src={image}
        alt=""
        fill
        sizes="(max-width: 960px) 180px, 220px"
      />
      <div className="card-label">{label}</div>
    </div>
  );
}

/* Engine step row */
function EngineStep({ num, title, copy }: { num: string; title: string; copy: string }) {
  return (
    <div className="engine-step">
      <div className="engine-step-num">{num}</div>
      <div className="engine-step-body">
        <h4>{title}</h4>
        <p>{copy}</p>
      </div>
    </div>
  );
}
