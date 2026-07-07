"use client";

import { AlertCircle, Check, CreditCard, Loader2, RefreshCw } from "lucide-react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { formatPersonaLimit, type BillingPlan, type BillingTopUp, type PublicPaddleConfig } from "@/lib/billing";
import { cn, formatTokens } from "@/lib/utils";

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
  copy = "Subscribe to unlock persona management and generation tools. Each plan includes a one-time $3 welcome credit grant.",
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
  onStatusResolved?: (status: { hasStudioAccess?: boolean; hasActiveSubscription?: boolean; balanceCents?: number; personaLimit?: number | null }) => void;
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
    if (!hasPlanIds) problems.push("Paddle price IDs are required for all subscription plans.");
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
      const data = (await response.json()) as { hasStudioAccess?: boolean; hasActiveSubscription?: boolean; balanceCents?: number; personaLimit?: number | null };
      onStatusResolved?.(data);
      if (data.hasActiveSubscription) {
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
          eyebrow: "text-[#d4a574]",
          title: "text-[#f1ebe3]",
          copy: "text-[#b3a9a0]",
          card: "rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-5 text-[#f1ebe3] shadow-[0_28px_90px_rgba(0,0,0,0.34)] transition hover:-translate-y-0.5 hover:border-[#ff4d6d]/35",
          description: "text-[#b3a9a0]",
          price: "text-[#ff8a9b]",
          meta: "text-[#7a716a]",
          benefit: "text-[#d8cec3]",
          check: "text-[#d4a574]",
          button: "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff4d6d] px-4 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.24)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82] disabled:cursor-not-allowed disabled:opacity-65",
          warning: "mt-5 rounded-[14px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 p-4 text-sm leading-6 text-[#ffd0e7]",
          message: "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-4 text-sm leading-6 text-[#d8cec3]",
          refresh: "inline-flex h-10 items-center gap-2 rounded-full border border-[#f1ebe3]/15 px-4 font-semibold text-[#f1ebe3] transition hover:border-[#ff4d6d]/70",
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

      <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                  {formatPersonaLimit(plan.personaLimit)}
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className={styles.check} />
                  Includes {formatTokens(plan.creditCents)} in welcome credits once
                </div>
                <div className="flex items-center gap-2">
                  <Check size={16} className={styles.check} />
                  Cancel anytime
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

export function TokenTopUps({
  userId,
  userEmail,
  supabaseReady,
  config,
  onStatusResolved,
}: {
  userId?: string;
  userEmail?: string;
  supabaseReady: boolean;
  config: PublicPaddleConfig;
  onStatusResolved?: (status: { hasStudioAccess?: boolean; hasActiveSubscription?: boolean; balanceCents?: number }) => void;
}) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [selectedTopUpId, setSelectedTopUpId] = useState(config.topUps[2]?.id ?? config.topUps[0]?.id);
  const [message, setMessage] = useState("");

  const selectedTopUp = config.topUps.find((topUp) => topUp.id === selectedTopUpId) ?? config.topUps[0];
  const hasAnyMissingPriceIds = config.topUps.some((topUp) => !topUp.priceId);
  const checkoutReady = supabaseReady && Boolean(userId) && Boolean(config.clientToken) && paddleReady;

  const setupProblems = useMemo(() => {
    const problems: string[] = [];
    if (!supabaseReady) problems.push("Supabase is not configured.");
    if (!config.clientToken) problems.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing.");
    if (hasAnyMissingPriceIds) problems.push("Add Paddle price IDs for all top-up amounts.");
    if (scriptReady && !paddleReady) problems.push("Paddle.js did not initialize.");
    return problems;
  }, [config.clientToken, hasAnyMissingPriceIds, paddleReady, scriptReady, supabaseReady]);

  const checkBillingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      if (response.status === 401) {
        setCheckoutState("error");
        setMessage("Your session expired. Sign in again before buying tokens.");
        return false;
      }
      if (!response.ok) {
        setMessage("Payment may be complete, but the balance could not be refreshed yet.");
        return false;
      }
      const data = (await response.json()) as { hasStudioAccess?: boolean; balanceCents?: number };
      onStatusResolved?.(data);
      setCheckoutState("success");
      setMessage(`Balance refreshed: ${formatTokens(data.balanceCents ?? 0)}.`);
      router.refresh();
      return true;
    } catch {
      setMessage("Payment may be complete, but the balance could not be checked. Try refreshing in a moment.");
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
            setMessage("Payment completed. Refreshing your balance...");
            void pollBillingStatus();
          }
          if (event.name === "checkout.closed" && checkoutState === "loading") {
            setCheckoutState("idle");
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

  function openCheckout(topUp: BillingTopUp & { priceId: string }) {
    if (!userId) {
      setCheckoutState("error");
      setMessage("Sign in before buying tokens.");
      return;
    }
    if (!topUp.priceId || !checkoutReady || !window.Paddle) {
      setCheckoutState("error");
      setMessage(
        setupProblems.length
          ? setupProblems.join(" ")
          : "Paddle is not ready yet. Try again in a moment.",
      );
      return;
    }

    setCheckoutState("loading");
    setMessage("Opening secure Paddle checkout...");

    try {
      window.Paddle.Checkout.open({
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
        },
        items: [{ priceId: topUp.priceId, quantity: 1 }],
        customer: userEmail ? { email: userEmail } : undefined,
        customData: {
          app_user_id: userId,
          plan_id: topUp.id,
          source: "persona_studio_settings_topup",
        },
      });
    } catch {
      setCheckoutState("error");
      setMessage("Checkout could not be opened. Confirm the Paddle price ID and checkout domain, then try again.");
    }
  }

  const isBusy = checkoutState === "loading" || checkoutState === "waiting";

  return (
    <section>
      <Script
        id="paddle-js-topups"
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

      <p className="text-lg font-semibold text-stone-950">Buy tokens</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {config.topUps.map((topUp) => {
          const isSelected = topUp.id === selectedTopUp?.id;
          return (
            <button
              key={topUp.id}
              type="button"
              onClick={() => setSelectedTopUpId(topUp.id)}
              className={cn(
                "flex h-14 items-center justify-center rounded-md border px-3 text-lg font-semibold transition",
                isSelected
                  ? "border-emerald-800 bg-emerald-50"
                  : "border-stone-200 bg-stone-50 hover:border-emerald-800",
              )}
            >
              {topUp.priceLabel}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => selectedTopUp && openCheckout(selectedTopUp)}
        disabled={!selectedTopUp || isBusy || !supabaseReady || !scriptReady || !selectedTopUp.priceId}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:bg-stone-300"
      >
        {isBusy ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
        {isBusy ? "Finalizing..." : selectedTopUp ? `Checkout ${selectedTopUp.priceLabel}` : "Checkout"}
      </button>

      {setupProblems.length ? (
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-600">
          <div className="flex gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-emerald-800" />
            <p>{setupProblems.join(" ")}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-600">
          <p>{message}</p>
          {checkoutState === "waiting" || checkoutState === "success" ? (
            <button
              type="button"
              onClick={() => void checkBillingStatus()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 font-semibold text-stone-700 transition hover:border-emerald-800 hover:text-stone-950"
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
