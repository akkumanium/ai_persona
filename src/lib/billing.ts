import { env } from "@/lib/env";

export type BillingPlanId = "starter" | "plus";

export type BillingPlan = {
  id: BillingPlanId;
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
};

export const billingPlans: BillingPlan[] = [
  {
    id: "starter",
    name: "Studio Light",
    priceLabel: "$5",
    tokenLabel: "5,000 tokens",
    creditCents: 5000,
    priceId: env.paddleFiveDollarPriceId,
    description: "A focused monthly balance for early persona and reference work.",
  },
  {
    id: "plus",
    name: "Studio Plus",
    priceLabel: "$10",
    tokenLabel: "10,000 tokens",
    creditCents: 10000,
    priceId: env.paddleTenDollarPriceId,
    description: "More room for image, video, and campaign iteration.",
  },
];

export function getPlanById(planId?: string | null) {
  return billingPlans.find((plan) => plan.id === planId);
}

export function getPlanByPriceId(priceId?: string | null) {
  return billingPlans.find((plan) => plan.priceId && plan.priceId === priceId);
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
      name: plan.name,
      priceLabel: plan.priceLabel,
      tokenLabel: plan.tokenLabel,
      creditCents: plan.creditCents,
      priceId: plan.priceId ?? "",
      description: plan.description,
    })),
  } satisfies PublicPaddleConfig;
}
