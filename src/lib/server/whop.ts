import Whop from "@whop/sdk";
import { billingPlans, billingTopUps } from "@/lib/billing";
import { env } from "@/lib/env";

let client: Whop | undefined;

export function getWhopClient() {
  if (!env.whopApiKey) throw new Error("WHOP_API_KEY is not configured.");
  if (!client) {
    client = new Whop({
      apiKey: env.whopApiKey,
      webhookKey: env.whopWebhookSecret ?? null,
      baseURL: env.whopEnvironment === "production"
        ? "https://api.whop.com/api/v1"
        : "https://sandbox-api.whop.com/api/v1",
      timeout: 15_000,
      maxRetries: 2,
    });
  }
  return client;
}

export function getWhopEnvironment(): "sandbox" | "production" {
  return env.whopEnvironment === "production" ? "production" : "sandbox";
}

export async function validateWhopCatalogWithProvider() {
  if (!env.whopCompanyId) throw new Error("WHOP_COMPANY_ID is not configured.");
  const options = [...billingPlans, ...billingTopUps];
  await Promise.all(options.map(async (option) => {
    if (!option.providerPlanId) throw new Error(`Whop plan is missing for ${option.id}.`);
    const plan = await getWhopClient().plans.retrieve(option.providerPlanId);
    if (plan.company?.id !== env.whopCompanyId) throw new Error(`Whop plan ${option.id} belongs to another company.`);
    if (plan.currency.toLowerCase() !== "usd") throw new Error(`Whop plan ${option.id} must use USD.`);
    const expectedType = option.kind === "subscription" ? "renewal" : "one_time";
    if (plan.plan_type !== expectedType) throw new Error(`Whop plan ${option.id} has the wrong billing type.`);
    if (option.kind === "subscription" && plan.billing_period !== 30) throw new Error(`Whop plan ${option.id} must renew monthly.`);
    if (plan.trial_period_days) throw new Error(`Whop plan ${option.id} must not have a trial.`);
    if (plan.adaptive_pricing_enabled) throw new Error(`Whop plan ${option.id} must disable adaptive pricing.`);
    const expectedPrice = Number(option.priceLabel.replace("$", ""));
    const actualPrice = option.kind === "subscription" ? plan.renewal_price : plan.initial_price;
    if (actualPrice !== expectedPrice) throw new Error(`Whop plan ${option.id} has the wrong price.`);
  }));
}
