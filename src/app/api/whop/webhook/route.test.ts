import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/whop/webhook/route";
import { env } from "@/lib/env";

const original = {
  whopApiKey: env.whopApiKey,
  whopWebhookSecret: env.whopWebhookSecret,
  whopCompanyId: env.whopCompanyId,
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  supabaseServiceRoleKey: env.supabaseServiceRoleKey,
};

afterEach(() => Object.assign(env, original));

describe("Whop webhook route", () => {
  it("rejects a payload without a valid Standard Webhooks signature", async () => {
    Object.assign(env, {
      whopApiKey: "test_api_key",
      whopWebhookSecret: "whsec_dGVzdF93ZWJob29rX3NlY3JldA==",
      whopCompanyId: "biz_test",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "test-anon-key",
      supabaseServiceRoleKey: "test-service-key",
    });
    const response = await POST(new Request("https://idolborn.test/api/whop/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "evt_forged", type: "payment.succeeded", timestamp: new Date().toISOString(), data: {} }),
    }));
    expect(response.status).toBe(401);
  });
});
