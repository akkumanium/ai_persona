"use client";

import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { AlertCircle, Check, CreditCard, Loader2, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPersonaLimit, type BillingPlan, type BillingTopUp, type PublicBillingConfig } from "@/lib/billing";
import { cn, formatTokens } from "@/lib/utils";

type CheckoutState = "idle" | "loading" | "waiting" | "success" | "error";
type BillingStatus = { hasStudioAccess?: boolean; hasActiveSubscription?: boolean; balanceCents?: number; personaLimit?: number | null };
type CheckoutSession = {
  checkoutIntentId: string;
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
};

function CheckoutModal({
  checkout,
  email,
  theme,
  onComplete,
  onClose,
}: {
  checkout: CheckoutSession;
  email?: string;
  theme: "light" | "dark";
  onComplete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Secure Whop checkout">
      <div className={cn("relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-2xl", theme === "dark" ? "bg-[#151214]" : "bg-white")}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/10 text-stone-600 backdrop-blur transition hover:bg-black/20" aria-label="Close checkout">
          <X size={19} />
        </button>
        <WhopCheckoutEmbed
          planId={checkout.planId}
          sessionId={checkout.sessionId}
          environment={checkout.environment}
          returnUrl={checkout.returnUrl}
          theme={theme}
          prefill={email ? { email } : undefined}
          disableEmail={Boolean(email)}
          adaptivePricing={false}
          onComplete={onComplete}
          onPaymentError={(error) => console.error("Whop checkout payment error", error.code)}
          styles={{ container: { paddingX: 20, paddingY: 24 } }}
        />
      </div>
    </div>
  );
}

export function BillingPlans({
  title = "Get studio access",
  copy = "Choose monthly or yearly access to unlock limitless personas and generation tools, plus a one-time $3 welcome credit grant.",
  userId,
  userEmail,
  supabaseReady,
  config,
  compact = false,
  theme = "light",
  actionLabel = "Subscribe",
  returnPath = "/pricing",
  onStatusResolved,
}: {
  title?: string;
  copy?: string;
  userId?: string;
  userEmail?: string;
  supabaseReady: boolean;
  config: PublicBillingConfig;
  compact?: boolean;
  theme?: "light" | "dark";
  actionLabel?: string;
  returnPath?: "/pricing" | "/studio";
  onStatusResolved?: (status: BillingStatus) => void;
}) {
  const router = useRouter();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [activePlanId, setActivePlanId] = useState<string>();
  const [checkout, setCheckout] = useState<CheckoutSession>();
  const [message, setMessage] = useState("");
  const checkoutReady = supabaseReady && Boolean(userId) && config.configured;

  const setupProblems = useMemo(() => {
    const problems: string[] = [];
    if (!supabaseReady) problems.push("Supabase is not configured.");
    if (!config.configured) problems.push("Whop billing is not fully configured.");
    return problems;
  }, [config.configured, supabaseReady]);

  const checkBillingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      if (response.status === 401) {
        setCheckoutState("error");
        setMessage("Your session expired. Sign in again before opening the studio.");
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as BillingStatus;
      onStatusResolved?.(data);
      if (data.hasActiveSubscription) {
        setCheckoutState("success");
        setMessage(`Studio access is active. Balance: ${formatTokens(data.balanceCents ?? 0)}.`);
        router.refresh();
        return true;
      }
      setMessage("Payment received by Whop. Waiting for the verified webhook to activate your account.");
      return false;
    } catch {
      setMessage("Payment may be complete, but billing status could not be checked. Try refreshing in a moment.");
      return false;
    }
  }, [onStatusResolved, router]);

  const pollBillingStatus = useCallback(async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await checkBillingStatus()) return;
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }
    setCheckoutState("waiting");
  }, [checkBillingStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "return") return;
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    const timeout = window.setTimeout(() => {
      setCheckoutState("waiting");
      setMessage("Checkout returned. Confirming access securely...");
      void pollBillingStatus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pollBillingStatus]);

  async function openCheckout(plan: BillingPlan) {
    if (!userId || !checkoutReady) {
      setCheckoutState("error");
      setMessage(userId ? setupProblems.join(" ") : "Sign in before choosing a studio plan.");
      return;
    }
    setCheckoutState("loading");
    setActivePlanId(plan.id);
    setMessage("Preparing secure Whop checkout...");
    try {
      setCheckout(await createCheckoutSession(plan.id, returnPath));
      setCheckoutState("idle");
      setMessage("");
    } catch (error) {
      setCheckoutState("error");
      setActivePlanId(undefined);
      setMessage(error instanceof Error ? error.message : "Checkout could not be opened.");
    }
  }

  const styles = theme === "dark" ? darkStyles : lightStyles;
  return (
    <section className={compact ? "mx-auto w-full max-w-5xl px-5 pb-14 sm:px-8" : "mx-auto w-full max-w-5xl px-5 py-14 sm:px-8"}>
      <div className="mx-auto max-w-2xl text-center">
        <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${styles.eyebrow}`}>Access</p>
        <h2 className={`mt-3 text-3xl font-semibold tracking-normal sm:text-4xl ${styles.title}`}>{title}</h2>
        <p className={`mt-4 text-base leading-7 ${styles.copy}`}>{copy}</p>
      </div>
      <div className={cn("mt-8 grid gap-4", config.plans.length === 1 ? "mx-auto max-w-md grid-cols-1" : config.plans.length === 2 ? "mx-auto max-w-3xl md:grid-cols-2" : "md:grid-cols-3")}>
        {config.plans.map((plan) => {
          const isBusy = activePlanId === plan.id && checkoutState === "loading";
          return <article key={plan.id} className={styles.card}>
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-xl font-semibold">{plan.name}</h3><p className={`mt-2 text-sm leading-6 ${styles.description}`}>{plan.description}</p></div>
              <div className="text-right"><p className={`text-3xl font-semibold ${styles.price}`}>{plan.priceLabel}</p><p className={`text-xs font-medium ${styles.meta}`}>{plan.billingIntervalLabel}</p></div>
            </div>
            <div className={`mt-5 grid gap-2 text-sm ${styles.benefit}`}>
              <Benefit text={formatPersonaLimit(plan.personaLimit)} className={styles.check} />
              <Benefit text={`${formatTokens(plan.creditCents)} welcome tokens`} className={styles.check} />
            </div>
            <button type="button" onClick={() => void openCheckout(plan)} disabled={isBusy || !checkoutReady} className={styles.button}>
              {isBusy ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
              {isBusy ? "Preparing..." : `${actionLabel} for ${plan.priceLabel}`}
            </button>
          </article>;
        })}
      </div>
      <BillingNotices setupProblems={setupProblems} message={message} checkoutState={checkoutState} styles={styles} onRefresh={checkBillingStatus} />
      {checkout ? <CheckoutModal checkout={checkout} email={userEmail} theme={theme} onClose={() => { setCheckout(undefined); setActivePlanId(undefined); }} onComplete={() => { setCheckout(undefined); setCheckoutState("waiting"); setMessage("Payment completed. Confirming access securely..."); void pollBillingStatus(); }} /> : null}
    </section>
  );
}

export function TokenTopUps({ userId, userEmail, supabaseReady, config, hasActiveSubscription, onStatusResolved }: {
  userId?: string;
  userEmail?: string;
  supabaseReady: boolean;
  config: PublicBillingConfig;
  hasActiveSubscription: boolean;
  onStatusResolved?: (status: BillingStatus) => void;
}) {
  const router = useRouter();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [selectedTopUpId, setSelectedTopUpId] = useState(config.topUps[2]?.id ?? config.topUps[0]?.id);
  const [checkout, setCheckout] = useState<CheckoutSession>();
  const [message, setMessage] = useState("");
  const balanceBeforeCheckout = useRef<number | undefined>(undefined);
  const selectedTopUp = config.topUps.find((topUp) => topUp.id === selectedTopUpId) ?? config.topUps[0];
  const checkoutReady = supabaseReady && Boolean(userId) && config.configured && hasActiveSubscription;
  const setupProblems = useMemo(() => {
    const problems: string[] = [];
    if (!supabaseReady) problems.push("Supabase is not configured.");
    if (!config.configured) problems.push("Whop billing is not fully configured.");
    return problems;
  }, [config.configured, supabaseReady]);

  const checkBillingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      if (!response.ok) return false;
      const data = (await response.json()) as BillingStatus;
      onStatusResolved?.(data);
      if (typeof data.balanceCents === "number" && typeof balanceBeforeCheckout.current === "number" && data.balanceCents > balanceBeforeCheckout.current) {
        sessionStorage.removeItem("idolborn.topupBalanceBeforeCheckout");
        setCheckoutState("success");
        setMessage(`Balance refreshed: ${formatTokens(data.balanceCents)}.`);
        router.refresh();
        return true;
      }
      setMessage("Payment received by Whop. Waiting for the verified webhook to add tokens.");
      return false;
    } catch {
      setMessage("Payment may be complete, but the balance could not be checked. Try refreshing in a moment.");
      return false;
    }
  }, [onStatusResolved, router]);

  const pollBillingStatus = useCallback(async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (await checkBillingStatus()) return;
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }
    setCheckoutState("waiting");
  }, [checkBillingStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "return") return;
    const storedBalance = Number(sessionStorage.getItem("idolborn.topupBalanceBeforeCheckout"));
    balanceBeforeCheckout.current = Number.isFinite(storedBalance) ? storedBalance : undefined;
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    const timeout = window.setTimeout(() => {
      setCheckoutState("waiting");
      setMessage("Checkout returned. Confirming tokens securely...");
      void pollBillingStatus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pollBillingStatus]);

  async function openCheckout(topUp: BillingTopUp) {
    if (!userId || !checkoutReady) {
      setCheckoutState("error");
      setMessage(!hasActiveSubscription ? "Token top-ups require an active subscription." : setupProblems.join(" "));
      return;
    }
    setCheckoutState("loading");
    setMessage("Preparing secure Whop checkout...");
    try {
      const status = await fetch("/api/billing/status", { cache: "no-store" });
      const current = status.ok ? await status.json() as BillingStatus : undefined;
      balanceBeforeCheckout.current = current?.balanceCents ?? 0;
      sessionStorage.setItem("idolborn.topupBalanceBeforeCheckout", String(balanceBeforeCheckout.current));
      setCheckout(await createCheckoutSession(topUp.id, "/studio"));
      setCheckoutState("idle");
      setMessage("");
    } catch (error) {
      setCheckoutState("error");
      setMessage(error instanceof Error ? error.message : "Checkout could not be opened.");
    }
  }

  const isBusy = checkoutState === "loading" || checkoutState === "waiting";
  return <section>
    <p className="text-lg font-semibold text-stone-950">Buy tokens</p>
    {!hasActiveSubscription ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Token top-ups are available only after you have an active subscription.</div> : null}
    <div className="mt-4 grid grid-cols-3 gap-2">
      {config.topUps.map((topUp) => <button key={topUp.id} type="button" onClick={() => setSelectedTopUpId(topUp.id)} className={cn("flex h-14 items-center justify-center rounded-md border px-3 text-lg font-semibold transition", topUp.id === selectedTopUp?.id ? "border-emerald-800 bg-emerald-50" : "border-stone-200 bg-stone-50 hover:border-emerald-800")}>{topUp.priceLabel}</button>)}
    </div>
    <button type="button" onClick={() => selectedTopUp && void openCheckout(selectedTopUp)} disabled={!selectedTopUp || isBusy || !checkoutReady} className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:bg-stone-300">
      {isBusy ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}{isBusy ? "Finalizing..." : selectedTopUp ? `Checkout ${selectedTopUp.priceLabel}` : "Checkout"}
    </button>
    {setupProblems.length ? <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-600"><div className="flex gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0 text-emerald-800" /><p>{setupProblems.join(" ")}</p></div></div> : null}
    {message ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-600"><p>{message}</p>{checkoutState === "waiting" || checkoutState === "success" ? <button type="button" onClick={() => void checkBillingStatus()} className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-200 px-3 font-semibold"><RefreshCw size={15} />Refresh status</button> : null}</div> : null}
    {checkout ? <CheckoutModal checkout={checkout} email={userEmail} theme="light" onClose={() => setCheckout(undefined)} onComplete={() => { setCheckout(undefined); setCheckoutState("waiting"); setMessage("Payment completed. Confirming tokens securely..."); void pollBillingStatus(); }} /> : null}
  </section>;
}

function Benefit({ text, className }: { text: string; className: string }) {
  return <div className="flex items-center gap-2"><Check size={16} className={className} />{text}</div>;
}

function BillingNotices({ setupProblems, message, checkoutState, styles, onRefresh }: { setupProblems: string[]; message: string; checkoutState: CheckoutState; styles: typeof lightStyles; onRefresh: () => Promise<boolean> }) {
  return <>{setupProblems.length ? <div className={styles.warning}><div className="flex gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{setupProblems.join(" ")}</p></div></div> : null}{message ? <div className={styles.message}><p>{message}</p>{checkoutState === "waiting" || checkoutState === "success" ? <button type="button" onClick={() => void onRefresh()} className={styles.refresh}><RefreshCw size={15} />Refresh status</button> : null}</div> : null}</>;
}

async function createCheckoutSession(optionId: string, returnPath: "/pricing" | "/studio") {
  const response = await fetch("/api/billing/checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId, returnPath }) });
  const payload = await response.json().catch(() => ({})) as Partial<CheckoutSession> & { error?: string };
  if (!response.ok || !payload.checkoutIntentId || !payload.sessionId || !payload.planId || !payload.environment || !payload.returnUrl) throw new Error(payload.error ?? "Could not prepare secure checkout.");
  return payload as CheckoutSession;
}

const darkStyles = {
  eyebrow: "text-[#d4a574]", title: "text-[#f1ebe3]", copy: "text-[#b3a9a0]", card: "rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-5 text-[#f1ebe3] shadow-[0_28px_90px_rgba(0,0,0,0.34)] transition hover:-translate-y-0.5 hover:border-[#ff4d6d]/35", description: "text-[#b3a9a0]", price: "text-[#ff8a9b]", meta: "text-[#7a716a]", benefit: "text-[#d8cec3]", check: "text-[#d4a574]", button: "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff4d6d] px-4 text-sm font-semibold text-[#0c0a0b] shadow-[0_14px_34px_rgba(255,77,109,0.24)] transition hover:-translate-y-0.5 hover:bg-[#ff6a82] disabled:cursor-not-allowed disabled:opacity-65", warning: "mt-5 rounded-[14px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 p-4 text-sm leading-6 text-[#ffd0e7]", message: "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#f1ebe3]/10 bg-[#151214] p-4 text-sm leading-6 text-[#d8cec3]", refresh: "inline-flex h-10 items-center gap-2 rounded-full border border-[#f1ebe3]/15 px-4 font-semibold text-[#f1ebe3] transition hover:border-[#ff4d6d]/70",
};
const lightStyles: typeof darkStyles = {
  eyebrow: "text-[#a83a6d]", title: "text-[#19141a]", copy: "text-[#695c66]", card: "rounded-lg border border-[#ead9e4] bg-[#fffafd] p-5 text-[#19141a] shadow-[0_18px_55px_rgba(96,61,80,0.08)]", description: "text-[#6d6069]", price: "text-[#c22f75]", meta: "text-[#82747d]", benefit: "text-[#433942]", check: "text-[#16735f]", button: "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#19141a] px-4 text-sm font-semibold text-white transition hover:bg-[#35242f] disabled:cursor-not-allowed disabled:opacity-65", warning: "mt-5 rounded-lg border border-[#f1c8d9] bg-[#fff5fa] p-4 text-sm leading-6 text-[#8a3158]", message: "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead9e4] bg-white p-4 text-sm leading-6 text-[#5e515b]", refresh: "inline-flex h-10 items-center gap-2 rounded-md border border-[#dcc5d4] px-3 font-semibold text-[#19141a] transition hover:border-[#c22f75]",
};
