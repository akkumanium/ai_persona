import { env } from "@/lib/env";

export type BillingPlanId = "starter" | "plus";
export type BillingTopUpId = "topup_2" | "topup_5" | "topup_10" | "topup_20" | "topup_50" | "topup_100";

export type BillingPlan = {
  id: BillingPlanId;
  kind: "subscription";
  name: string;
  priceLabel: string;
  tokenLabel: string;
  creditCents: number;
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
    id: "starter",
    kind: "subscription",
    name: "Studio Light",
    priceLabel: "$5",
    tokenLabel: "5,000 tokens",
    creditCents: 5000,
    priceId: env.paddleFiveDollarPriceId,
    description: "A focused monthly balance for early persona and reference work.",
  },
  {
    id: "plus",
    kind: "subscription",
    name: "Studio Plus",
    priceLabel: "$10",
    tokenLabel: "10,000 tokens",
    creditCents: 10000,
    priceId: env.paddleTenDollarPriceId,
    description: "More room for image, video, and campaign iteration.",
  },
];

export const billingTopUps: BillingTopUp[] = [
  {
    id: "topup_2",
    kind: "topup",
    name: "Small top-up",
    priceLabel: "$2",
    tokenLabel: "2,000 tokens",
    creditCents: 2000,
    priceId: env.paddleTwoDollarPriceId,
    description: "A quick bump for a few image iterations.",
  },
  {
    id: "topup_5",
    kind: "topup",
    name: "Starter top-up",
    priceLabel: "$5",
    tokenLabel: "5,000 tokens",
    creditCents: 5000,
    priceId: env.paddleFiveDollarPriceId,
    description: "Enough for references and lighter still-image work.",
  },
  {
    id: "topup_10",
    kind: "topup",
    name: "Creator top-up",
    priceLabel: "$10",
    tokenLabel: "10,000 tokens",
    creditCents: 10000,
    priceId: env.paddleTenDollarPriceId,
    description: "A comfortable refill for daily generation.",
  },
  {
    id: "topup_20",
    kind: "topup",
    name: "Campaign top-up",
    priceLabel: "$20",
    tokenLabel: "20,000 tokens",
    creditCents: 20000,
    priceId: env.paddleTwentyDollarPriceId,
    description: "More room for image sets and video tests.",
  },
  {
    id: "topup_50",
    kind: "topup",
    name: "Studio top-up",
    priceLabel: "$50",
    tokenLabel: "50,000 tokens",
    creditCents: 50000,
    priceId: env.paddleFiftyDollarPriceId,
    description: "For larger batches and production weeks.",
  },
  {
    id: "topup_100",
    kind: "topup",
    name: "Scale top-up",
    priceLabel: "$100",
    tokenLabel: "100,000 tokens",
    creditCents: 100000,
    priceId: env.paddleHundredDollarPriceId,
    description: "Best for sustained video and campaign output.",
  },
];

export function getPlanById(planId?: string | null) {
  return billingPlans.find((plan) => plan.id === planId);
}

export function getPlanByPriceId(priceId?: string | null) {
  return billingPlans.find((plan) => plan.priceId && plan.priceId === priceId);
}

export function getBillingOptionById(optionId?: string | null) {
  return [...billingPlans, ...billingTopUps].find((option) => option.id === optionId);
}

export function getBillingOptionByPriceId(priceId?: string | null) {
  return [...billingPlans, ...billingTopUps].find((option) => option.priceId && option.priceId === priceId);
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
