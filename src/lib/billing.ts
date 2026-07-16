import { env } from "@/lib/env";

export type BillingPlanId = "monthly" | "yearly";
export type BillingTopUpId = "topup_2" | "topup_5" | "topup_10" | "topup_20" | "topup_50" | "topup_100";
export const WELCOME_CREDIT_CENTS = 300;
export const UNLIMITED_PERSONAS = null;

export type BillingPlan = {
  id: BillingPlanId;
  kind: "subscription";
  name: string;
  priceLabel: string;
  billingIntervalLabel: string;
  billingPeriodDays: number;
  tokenLabel: string;
  creditCents: number;
  personaLimit: number | null;
  providerPlanId?: string;
  description: string;
};

export type BillingTopUp = {
  id: BillingTopUpId;
  kind: "topup";
  name: string;
  priceLabel: string;
  tokenLabel: string;
  creditCents: number;
  providerPlanId?: string;
  description: string;
};

export type PublicBillingConfig = {
  environment: "sandbox" | "production";
  configured: boolean;
  plans: Array<Omit<BillingPlan, "providerPlanId">>;
  topUps: Array<Omit<BillingTopUp, "providerPlanId">>;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "monthly",
    kind: "subscription",
    name: "Monthly",
    priceLabel: "$12",
    billingIntervalLabel: "monthly",
    billingPeriodDays: 30,
    tokenLabel: "300 welcome tokens",
    creditCents: WELCOME_CREDIT_CENTS,
    personaLimit: UNLIMITED_PERSONAS,
    providerPlanId: env.whopMonthlyPlanId,
    description: "Full Studio access with limitless personas, billed monthly.",
  },
  {
    id: "yearly",
    kind: "subscription",
    name: "Yearly",
    priceLabel: "$80",
    billingIntervalLabel: "yearly",
    billingPeriodDays: 365,
    tokenLabel: "300 welcome tokens",
    creditCents: WELCOME_CREDIT_CENTS,
    personaLimit: UNLIMITED_PERSONAS,
    providerPlanId: env.whopYearlyPlanId,
    description: "Full Studio access with limitless personas, billed yearly.",
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
    providerPlanId: env.whopTwoDollarTopUpPlanId,
    description: "A quick bump for a few image iterations.",
  },
  {
    id: "topup_5",
    kind: "topup",
    name: "Starter top-up",
    priceLabel: "$5",
    tokenLabel: "500 tokens",
    creditCents: 500,
    providerPlanId: env.whopFiveDollarTopUpPlanId,
    description: "Enough for references and lighter still-image work.",
  },
  {
    id: "topup_10",
    kind: "topup",
    name: "Creator top-up",
    priceLabel: "$10",
    tokenLabel: "1,000 tokens",
    creditCents: 1000,
    providerPlanId: env.whopTenDollarTopUpPlanId,
    description: "A comfortable refill for daily generation.",
  },
  {
    id: "topup_20",
    kind: "topup",
    name: "Campaign top-up",
    priceLabel: "$20",
    tokenLabel: "2,000 tokens",
    creditCents: 2000,
    providerPlanId: env.whopTwentyDollarTopUpPlanId,
    description: "More room for image sets and video tests.",
  },
  {
    id: "topup_50",
    kind: "topup",
    name: "Studio top-up",
    priceLabel: "$50",
    tokenLabel: "5,000 tokens",
    creditCents: 5000,
    providerPlanId: env.whopFiftyDollarTopUpPlanId,
    description: "For larger batches and production weeks.",
  },
  {
    id: "topup_100",
    kind: "topup",
    name: "Scale top-up",
    priceLabel: "$100",
    tokenLabel: "10,000 tokens",
    creditCents: 10000,
    providerPlanId: env.whopHundredDollarTopUpPlanId,
    description: "Best for sustained video and campaign output.",
  },
];

export function normalizeBillingPlanId(planId?: string | null): BillingPlanId | undefined {
  if (!planId) return undefined;
  if (planId === "monthly" || planId === "yearly") return planId;
  return undefined;
}

export function getPlanById(planId?: string | null) {
  const normalizedPlanId = normalizeBillingPlanId(planId);
  return billingPlans.find((plan) => plan.id === normalizedPlanId);
}

export function getPlanByProviderPlanId(providerPlanId?: string | null) {
  return billingPlans.find((plan) => plan.providerPlanId && plan.providerPlanId === providerPlanId);
}

export function getBillingOptionById(optionId?: string | null) {
  const plan = getPlanById(optionId);
  if (plan) return plan;
  return [...billingPlans, ...billingTopUps].find((option) => option.id === optionId);
}

export function getBillingOptionByProviderPlanId(providerPlanId?: string | null) {
  if (!providerPlanId) return undefined;
  const matches = [...billingPlans, ...billingTopUps].filter((option) => option.providerPlanId === providerPlanId);
  if (matches.length > 1) throw new Error(`Whop plan ID ${providerPlanId} is configured more than once.`);
  return matches[0];
}

export function assertValidBillingCatalog() {
  if (env.whopEnvironment !== "sandbox" && env.whopEnvironment !== "production") {
    throw new Error("WHOP_ENVIRONMENT must be sandbox or production.");
  }
  const configured = [...billingPlans, ...billingTopUps].filter((option) => option.providerPlanId);
  const duplicate = configured.find((option, index) => configured.findIndex((candidate) => candidate.providerPlanId === option.providerPlanId) !== index);
  if (duplicate) throw new Error(`Whop plan ID ${duplicate.providerPlanId} must be unique.`);
  if (env.whopEnvironment === "production" && configured.length !== billingPlans.length + billingTopUps.length) {
    throw new Error("Every Whop subscription and top-up plan ID is required in production.");
  }
}

export function getPersonaLimitForPlan(planId?: string | null) {
  const plan = getPlanById(planId);
  return plan ? plan.personaLimit : 0;
}

export function formatPersonaLimit(limit: number | null) {
  return limit === null ? "Limitless personas" : `${limit} persona${limit === 1 ? "" : "s"}`;
}

const WHOP_MEMBERSHIP_STATUSES = new Set([
  "trialing", "active", "past_due", "completed", "canceled", "expired", "unresolved", "drafted", "canceling",
]);

export function mapWhopMembershipStatus(status?: string | null, cancelAtPeriodEnd = false) {
  const normalized = status?.toLowerCase();
  if (cancelAtPeriodEnd && (normalized === "active" || normalized === "trialing")) return "canceling";
  return normalized && WHOP_MEMBERSHIP_STATUSES.has(normalized) ? normalized : "drafted";
}

export function hasWhopBillingEnv() {
  return Boolean(
    env.whopApiKey &&
    env.whopWebhookSecret &&
    env.whopCompanyId &&
    [...billingPlans, ...billingTopUps].every((option) => option.providerPlanId),
  );
}

export function getPublicBillingConfig(): PublicBillingConfig {
  assertValidBillingCatalog();
  const environment: "sandbox" | "production" =
    env.whopEnvironment === "production" ? "production" : "sandbox";

  return {
    environment,
    configured: hasWhopBillingEnv(),
    plans: billingPlans.map(toPublicOption),
    topUps: billingTopUps.map(toPublicOption),
  };
}

function toPublicOption<T extends { providerPlanId?: string }>(option: T): Omit<T, "providerPlanId"> {
  const copy = { ...option };
  delete copy.providerPlanId;
  return copy;
}
