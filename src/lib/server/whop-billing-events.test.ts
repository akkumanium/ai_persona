import { describe, expect, it } from "vitest";
import { decimalToMinor, normalizeWhopEvent } from "@/lib/server/whop-billing-events";

describe("Whop webhook normalization", () => {
  it("normalizes money and trusted fulfillment fields", () => {
    const event = normalizeWhopEvent({
      id: "evt_1",
      type: "payment.succeeded",
      timestamp: "2026-07-14T10:00:00Z",
      company_id: "biz_1",
      data: {
        id: "pay_1",
        status: "succeeded",
        currency: "USD",
        total: "10.01",
        plan: { id: "plan_solo" },
        membership: { id: "mem_1", status: "active" },
        user: { id: "user_1", email: "must-not-persist@example.com" },
        billing_address: { line1: "must not persist" },
        card_last4: "4242",
        metadata: { schema_version: "1", app_user_id: "app-user", checkout_intent_id: "intent-1", injected: "drop me" },
      },
    });

    expect(event.companyId).toBe("biz_1");
    expect(event.payload).toMatchObject({ paymentId: "pay_1", currency: "usd", paidAmountMinor: 1001, providerPlanId: "plan_solo" });
    expect(JSON.stringify(event.payload)).not.toContain("must-not-persist");
    expect(JSON.stringify(event.payload)).not.toContain("4242");
    expect(JSON.stringify(event.payload)).not.toContain("injected");
  });

  it("minimizes unsupported events", () => {
    const event = normalizeWhopEvent({ id: "evt_2", type: "user.updated", timestamp: "2026-07-14T10:00:00Z", data: { id: "user_2", email: "private@example.com" } });
    expect(event.payload).toEqual({});
    expect(event.entityId).toBe("user_2");
  });

  it("rejects events without stable envelope fields", () => {
    expect(() => normalizeWhopEvent({ type: "payment.succeeded", data: {} })).toThrow(/missing its ID/);
  });
});

describe("Whop monetary conversion", () => {
  it.each([["0", 0], [2, 200], ["19.995", 2000], ["bad", 0], [-1, 0]])("converts %s to minor units", (input, expected) => {
    expect(decimalToMinor(input)).toBe(expected);
  });
});
