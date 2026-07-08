import { env } from "@/lib/env";

export type BillingPlanId = "solo" | "creator" | "agency";
export type BillingTopUpId = "topup_2" | "topup_5" | "topup_10" | "topup_20" | "topup_50" | "topup_100";
export const WELCOME_CREDIT_CENTS = 300;
export const UNLIMITED_PERSONAS = null;
const legacyPlanAliases: Partial<Record<string, BillingPlanId>> = {
  starter: "solo",
  plus: "creator",
  pro: "agency",
};

export type BillingPlan = {
  id: BillingPlanId;
  kind: "subscription";
  name: string;
  priceLabel: string;
  tokenLabel: string;
  creditCents: number;
  personaLimit: number | null;
  priceId?: string;
  description: string;
};

export type BillingTopUp = {
  id: BillingTopUpId;
  kind: "topup";
  name: string;
  priceLabel: string;
  tokenLabel: string;
  creditCents: number;
  priceId?: string;
  description: string;
};

export type PublicPaddleConfig = {
  clientToken: string;
  environment: "sandbox" | "production";
  plans: Array<BillingPlan & { priceId: string }>;
  topUps: Array<BillingTopUp & { priceId: string }>;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "solo",
    kind: "subscription",
    name: "Solo",
    priceLabel: "$10",
    tokenLabel: "300 welcome tokens",
    creditCents: WELCOME_CREDIT_CENTS,
    personaLimit: 1,
    priceId: env.paddleSoloSubscriptionPriceId,
    description: "For one creator persona with the full generation workspace.",
  },
  {
    id: "creator",
    kind: "subscription",
    name: "Creator",
    priceLabel: "$50",
    tokenLabel: "300 welcome tokens",
    creditCents: WELCOME_CREDIT_CENTS,
    personaLimit: 5,
    priceId: env.paddleCreatorSubscriptionPriceId,
    description: "For managing a small portfolio of up to five personas.",
  },
  {
    id: "agency",
    kind: "subscription",
    name: "Agency",
    priceLabel: "$100",
    tokenLabel: "300 welcome tokens",
    creditCents: WELCOME_CREDIT_CENTS,
    personaLimit: UNLIMITED_PERSONAS,
    priceId: env.paddleAgencySubscriptionPriceId,
    description: "For teams and operators who need limitless personas.",
  },
];

export const billingTopUps: BillingTopUp[] = [
  {
    id: "topup_2",
    kind: "topup",
    name: "Small top-up",
    priceLabel: "$2",
    tokenLabel: "200 tokens",
    creditCents: 200,
    priceId: env.paddleTwoDollarPriceId,
    description: "A quick bump for a few image iterations.",
  },
  {
    id: "topup_5",
    kind: "topup",
    name: "Starter top-up",
    priceLabel: "$5",
    tokenLabel: "500 tokens",
    creditCents: 500,
    priceId: env.paddleFiveDollarPriceId,
    description: "Enough for references and lighter still-image work.",
  },
  {
    id: "topup_10",
    kind: "topup",
    name: "Creator top-up",
    priceLabel: "$10",
    tokenLabel: "1,000 tokens",
    creditCents: 1000,
    priceId: env.paddleTenDollarTopUpPriceId,
    description: "A comfortable refill for daily generation.",
  },
  {
    id: "topup_20",
    kind: "topup",
    name: "Campaign top-up",
    priceLabel: "$20",
    tokenLabel: "2,000 tokens",
    creditCents: 2000,
    priceId: env.paddleTwentyDollarPriceId,
    description: "More room for image sets and video tests.",
  },
  {
    id: "topup_50",
    kind: "topup",
    name: "Studio top-up",
    priceLabel: "$50",
    tokenLabel: "5,000 tokens",
    creditCents: 5000,
    priceId: env.paddleFiftyDollarTopUpPriceId,
    description: "For larger batches and production weeks.",
  },
  {
    id: "topup_100",
    kind: "topup",
    name: "Scale top-up",
    priceLabel: "$100",
    tokenLabel: "10,000 tokens",
    creditCents: 10000,
    priceId: env.paddleHundredDollarTopUpPriceId,
    description: "Best for sustained video and campaign output.",
  },
];

export function normalizeBillingPlanId(planId?: string | null): BillingPlanId | undefined {
  if (!planId) return undefined;
  if (planId === "solo" || planId === "creator" || planId === "agency") return planId;
  return legacyPlanAliases[planId];
}

export function getPlanById(planId?: string | null) {
  const normalizedPlanId = normalizeBillingPlanId(planId);
  return billingPlans.find((plan) => plan.id === normalizedPlanId);
}

export function getPlanByPriceId(priceId?: string | null) {
  return billingPlans.find((plan) => plan.priceId && plan.priceId === priceId);
}

export function getBillingOptionById(optionId?: string | null) {
  const plan = getPlanById(optionId);
  if (plan) return plan;
  return [...billingPlans, ...billingTopUps].find((option) => option.id === optionId);
}

export function getBillingOptionByPriceId(priceId?: string | null) {
  return [...billingPlans, ...billingTopUps].find((option) => option.priceId && option.priceId === priceId);
}

export function getPersonaLimitForPlan(planId?: string | null) {
  const plan = getPlanById(planId);
  return plan ? plan.personaLimit : 0;
}

export function formatPersonaLimit(limit: number | null) {
  return limit === null ? "Limitless personas" : `${limit} persona${limit === 1 ? "" : "s"}`;
}

export function hasPaddleCheckoutEnv() {
  return Boolean(env.paddleClientToken && billingPlans.every((plan) => plan.priceId));
}

export function getPublicPaddleConfig() {
  const environment: "sandbox" | "production" =
    env.paddleEnvironment === "production" ? "production" : "sandbox";

  return {
    clientToken: env.paddleClientToken ?? "",
    environment,
    plans: billingPlans.map((plan) => ({
      id: plan.id,
      kind: plan.kind,
      name: plan.name,
      priceLabel: plan.priceLabel,
      tokenLabel: plan.tokenLabel,
      creditCents: plan.creditCents,
      personaLimit: plan.personaLimit,
      priceId: plan.priceId ?? "",
      description: plan.description,
    })),
    topUps: billingTopUps.map((topUp) => ({
      id: topUp.id,
      kind: topUp.kind,
      name: topUp.name,
      priceLabel: topUp.priceLabel,
      tokenLabel: topUp.tokenLabel,
      creditCents: topUp.creditCents,
      priceId: topUp.priceId ?? "",
      description: topUp.description,
    })),
  } satisfies PublicPaddleConfig;
}
