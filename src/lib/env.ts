export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  wavespeedApiKey: process.env.WAVESPEED_API_KEY,
  wavespeedWebhookUrl: process.env.WAVESPEED_WEBHOOK_URL,
  wavespeedWebhookSecret: process.env.WAVESPEED_WEBHOOK_SECRET,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "imblueop@gmail.com",
  whopApiKey: process.env.WHOP_API_KEY,
  whopWebhookSecret: process.env.WHOP_WEBHOOK_SECRET,
  whopCompanyId: process.env.WHOP_COMPANY_ID,
  whopEnvironment: process.env.WHOP_ENVIRONMENT ?? "sandbox",
  whopMonthlyPlanId: process.env.WHOP_MONTHLY_PLAN_ID,
  whopYearlyPlanId: process.env.WHOP_YEARLY_PLAN_ID,
  whopTwoDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_2,
  whopFiveDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_5,
  whopTenDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_10,
  whopTwentyDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_20,
  whopFiftyDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_50,
  whopHundredDollarTopUpPlanId: process.env.WHOP_TOPUP_PLAN_ID_100,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  cronSecret: process.env.CRON_SECRET,
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
