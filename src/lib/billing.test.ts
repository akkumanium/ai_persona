import { afterEach, describe, expect, it } from "vitest";
import {
  assertValidBillingCatalog,
  billingPlans,
  billingTopUps,
  getBillingOptionByProviderPlanId,
  getPublicBillingConfig,
  mapWhopMembershipStatus,
} from "@/lib/billing";
import { env } from "@/lib/env";
import { getWhopEnvironment } from "@/lib/server/whop";

const originalIds = [...billingPlans, ...billingTopUps].map((option) => option.providerPlanId);
const originalEnvironment = env.whopEnvironment;

afterEach(() => {
  [...billingPlans, ...billingTopUps].forEach((option, index) => { option.providerPlanId = originalIds[index]; });
  env.whopEnvironment = originalEnvironment;
});

describe("Whop environment selection", () => {
  it("uses production only when explicitly configured", () => {
    env.whopEnvironment = "production";
    expect(getWhopEnvironment()).toBe("production");
    env.whopEnvironment = "sandbox";
    expect(getWhopEnvironment()).toBe("sandbox");
  });
});

describe("Whop billing catalog", () => {
  it("rejects duplicate provider plan IDs", () => {
    billingPlans[0].providerPlanId = "plan_duplicate";
    billingTopUps[0].providerPlanId = "plan_duplicate";
    expect(() => assertValidBillingCatalog()).toThrow(/must be unique/);
    expect(() => getBillingOptionByProviderPlanId("plan_duplicate")).toThrow(/configured more than once/);
  });

  it("never exposes provider plan IDs in public page data", () => {
    const config = getPublicBillingConfig();
    expect(config.plans).toHaveLength(3);
    expect(config.topUps).toHaveLength(6);
    expect(config.plans.every((plan) => !("providerPlanId" in plan))).toBe(true);
    expect(config.topUps.every((topUp) => !("providerPlanId" in topUp))).toBe(true);
  });
});

describe("Whop membership status mapping", () => {
  it("keeps access while cancellation is scheduled", () => {
    expect(mapWhopMembershipStatus("active", true)).toBe("canceling");
    expect(mapWhopMembershipStatus("trialing", true)).toBe("canceling");
  });

  it("maps unknown provider states to a non-access state", () => {
    expect(mapWhopMembershipStatus("future_state")).toBe("drafted");
    expect(mapWhopMembershipStatus("PAST_DUE")).toBe("past_due");
  });
});
