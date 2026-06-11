"use client";

import { AlertCircle, Check, CreditCard, Loader2, RefreshCw } from "lucide-react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { BillingPlan, PublicPaddleConfig } from "@/lib/billing";
import { formatTokens } from "@/lib/utils";

type CheckoutState = "idle" | "loading" | "waiting" | "success" | "error";

type PaddleEvent = {
  name?: string;
  data?: {
    transaction_id?: string;
    status?: string;
  };
};

declare global {
  interface Window {
    Paddle?: {
      Environment?: {
        set(environment: "sandbox" | "production"): void;
      };
      Initialize(options: {
        token: string;
        eventCallback?: (event: PaddleEvent) => void;
      }): void;
      Checkout: {
        open(options: Record<string, unknown>): void;
      };
    };
  }
}

export function BillingPlans({
  title = "Choose studio access",
  copy = "Subscribe to unlock the studio. Each successful subscription payment adds the same amount back to your generation balance.",
  userId,
  userEmail,
  supabaseReady,
  config,
  compact = false,
  theme = "light",
  actionLabel = "Subscribe",
  onStatusResolved,
}: {
  title?: string;
  copy?: string;
  userId?: string;
  userEmail?: string;
  supabaseReady: boolean;
  config: PublicPaddleConfig;
  compact?: boolean;
  theme?: "light" | "dark";
  actionLabel?: string;
  onStatusResolved?: (status: { hasStudioAccess?: boolean; balanceCents?: number }) => void;
}) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [activePlanId, setActivePlanId] = useState<string>();
  const [message, setMessage] = useState("");

  const hasPlanIds = config.plans.every((plan) => Boolean(plan.priceId));
  const checkoutReady = supabaseReady && Boolean(userId) && Boolean(config.clientToken) && hasPlanIds && paddleReady;

  const setupProblems = useMemo(() => {
    const problems: string[] = [];
    if (!supabaseReady) problems.push("Supabase is not configured.");
    if (!config.clientToken) problems.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing.");
    if (!hasPlanIds) problems.push("Both Paddle price IDs are required.");
    if (scriptReady && !paddleReady) problems.push("Paddle.js did not initialize.");
    return problems;
  }, [config.clientToken, hasPlanIds, paddleReady, scriptReady, supabaseReady]);

  const checkBillingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      if (response.status === 401) {
        setCheckoutState("error");
        setMessage("Your session expired. Sign in again before opening the studio.");
        return false;
      }
      if (!response.ok) {
        setMessage("Payment may be complete, but the billing status could not be refreshed yet.");
        return false;
      }
      const data = (await response.json()) as { hasStudioAccess?: boolean; balanceCents?: number };
      onStatusResolved?.(data);
      if (data.hasStudioAccess) {
        setCheckoutState("success");
        setMessage(`Studio access is active. Balance: ${formatTokens(data.balanceCents ?? 0)}.`);
        router.refresh();
        return true;
      }
      setMessage("Payment received by Paddle. Waiting for the secure webhook to update your account.");
      return false;
    } catch {
      setMessage("Payment may be complete, but the billing status could not be checked. Try refreshing in a moment.");
      return false;
    }
  }, [onStatusResolved, router]);

  const pollBillingStatus = useCallback(async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const isReady = await checkBillingStatus();
      if (isReady) return;
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }
    setCheckoutState("waiting");
  }, [checkBillingStatus]);

  const initializePaddle = useCallback(() => {
    if (!window.Paddle || !config.clientToken) return;

    try {
      if (config.environment === "sandbox") {
        window.Paddle.Environment?.set("sandbox");
      }
      window.Paddle.Initialize({
        token: config.clientToken,
        eventCallback(event) {
          if (event.name === "checkout.completed") {
            setCheckoutState("waiting");
            setMessage("Payment completed. Finalizing access securely...");
            void pollBillingStatus();
          }
          if (event.name === "checkout.closed" && checkoutState === "loading") {
            setCheckoutState("idle");
            setActivePlanId(undefined);
            setMessage("Checkout was closed before payment completed.");
          }
        },
      });
      setPaddleReady(true);
      setMessage("");
    } catch {
      setPaddleReady(false);
      setCheckoutState("error");
      setMessage("Paddle could not initialize. Check the client token, environment, and approved checkout domain.");
    }
  }, [checkoutState, config.clientToken, config.environment, pollBillingStatus]);

  function openCheckout(plan: BillingPlan & { priceId: string }) {
    if (!userId) {
      setCheckoutState("error");
      setMessage("Sign in before choosing a studio plan.");
      return;
    }
    if (!checkoutReady || !window.Paddle) {
      setCheckoutState("error");
      setMessage(
        setupProblems.length
          ? setupProblems.join(" ")
          : "Paddle is not ready yet. Try again in a moment.",
      );
      return;
    }

    setCheckoutState("loading");
    setActivePlanId(plan.id);
    setMessage("Opening secure Paddle checkout...");

    try {
      window.Paddle.Checkout.open({
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
        },
        items: [{ priceId: plan.priceId, quantity: 1 }],
        customer: userEmail ? { email: userEmail } : undefined,
        customData: {
          app_user_id: userId,
          plan_id: plan.id,
          source: "persona_studio",
        },
      });
    } catch {
      setCheckoutState("error");
      setActivePlanId(undefined);
      setMessage("Checkout could not be opened. Confirm the Paddle price ID and checkout domain, then try again.");
    }
  }

  const styles =
    theme === "dark"
      ? {
          eyebrow: "text-[#ff77b8]",
          title: "text-white",
          copy: "text-[#aeb4c6]",
          card: "rounded-lg border border-white/10 bg-white/[0.055] p-5 text-white shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur",
          description: "text-[#aeb4c6]",
          price: "text-[#ff77b8]",
          meta: "text-[#9fa6b8]",
          benefit: "text-[#d9dce8]",
          check: "text-[#8db7ff]",
          button: "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8] disabled:cursor-not-allowed disabled:opacity-65",
          warning: "mt-5 rounded-lg border border-[#ff4fa3]/25 bg-[#ff4fa3]/10 p-4 text-sm leading-6 text-[#ffd0e7]",
          message: "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-[#d9dce8] backdrop-blur",
          refresh: "inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.14] px-3 font-semibold text-white transition hover:border-[#ff4fa3]/70",
        }
      : {
          eyebrow: "text-[#a83a6d]",
          title: "text-[#19141a]",
          copy: "text-[#695c66]",
          card: "rounded-lg border border-[#ead9e4] bg-[#fffafd] p-5 text-[#19141a] shadow-[0_18px_55px_rgba(96,61,80,0.08)]",
          description: "text-[#6d6069]",
          price: "text-[#c22f75]",
          meta: "text-[#82747d]",
          benefit: "text-[#433942]",
          check: "text-[#16735f]",
          button: "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#19141a] px-4 text-sm font-semibold text-white transition hover:bg-[#35242f] disabled:cursor-not-allowed disabled:opacity-65",
          warning: "mt-5 rounded-lg border border-[#f1c8d9] bg-[#fff5fa] p-4 text-sm leading-6 text-[#8a3158]",
          message: "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead9e4] bg-white p-4 text-sm leading-6 text-[#5e515b]",
          refresh: "inline-flex h-10 items-center gap-2 rounded-md border border-[#dcc5d4] px-3 font-semibold text-[#19141a] transition hover:border-[#c22f75]",
        };

  return (
    <section className={compact ? "mx-auto w-full max-w-5xl px-5 pb-14 sm:px-8" : "mx-auto w-full max-w-5xl px-5 py-14 sm:px-8"}>
      <Script
        id="paddle-js"
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptReady(true);
          initializePaddle();
        }}
        onError={() => {
          setScriptReady(true);
          setPaddleReady(false);
          setCheckoutState("error");
          setMessage("Paddle.js could not be loaded. Check your connection or content security policy.");
        }}
      />

      <div className="mx-auto max-w-2xl text-center">
        <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${styles.eyebrow}`}>Access</p>
        <h2 className={`mt-3 text-3xl font-semibold tracking-normal sm:text-4xl ${styles.title}`}>{title}</h2>
        <p className={`mt-4 text-base leading-7 ${styles.copy}`}>{copy}</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {config.plans.map((plan) => {
          const isBusy = activePlanId === plan.id && (checkoutState === "loading" || checkoutState === "waiting");
          return (
            <article
              key={plan.id}
              className={styles.card}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className={`mt-2 text-sm leading-6 ${styles.description}`}>{plan.description}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-semibold ${styles.price}`}>{plan.priceLabel}</p>
                  <p className={`text-xs font-medium ${styles.meta}`}>monthly</p>
                </div>
              </div>

              <div className={`mt-5 grid gap-2 text-sm ${styles.benefit}`}>
                <div className="flex items-center gap-2">
                  <Check size={16} className={styles.check} />
                  Adds {formatTokens(plan.creditCents)} to balance after successful payment
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className={styles.check} />
                  Unlocks saved personas, assets, and generation tools
                </div>
              </div>

              <button
                type="button"
                onClick={() => openCheckout(plan)}
                disabled={isBusy || !supabaseReady || !scriptReady}
                className={styles.button}
              >
                {isBusy ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
                {isBusy ? "Finalizing..." : `${actionLabel} for ${plan.priceLabel}`}
              </button>
            </article>
          );
        })}
      </div>

      {setupProblems.length ? (
        <div className={styles.warning}>
          <div className="flex gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{setupProblems.join(" ")}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className={styles.message}>
          <p>{message}</p>
          {checkoutState === "waiting" || checkoutState === "success" ? (
            <button
              type="button"
              onClick={() => void checkBillingStatus()}
              className={styles.refresh}
            >
              <RefreshCw size={15} />
              Refresh status
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
