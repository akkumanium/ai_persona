export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  nanoBananaModel: process.env.NANO_BANANA_MODEL ?? "gemini-3-pro-image",
  wanApiBaseUrl: process.env.WAN_API_BASE_URL,
  wanApiKey: process.env.WAN_API_KEY,
  klingApiBaseUrl: process.env.KLING_API_BASE_URL ?? "https://api-singapore.klingai.com",
  klingApiKey: process.env.KLING_API_KEY,
  klingModel: process.env.KLING_MODEL ?? "kling-v2-6",
  seedanceApiBaseUrl: process.env.SEEDANCE_API_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com",
  seedanceApiKey: process.env.SEEDANCE_API_KEY,
  seedanceModel: process.env.SEEDANCE_MODEL ?? "dreamina-seedance-2-0-260128",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "imblueop@gmail.com",
  paddleClientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  paddleEnvironment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? "sandbox",
  paddleTwoDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_2,
  paddleFiveDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_5,
  paddleTenDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_10,
  paddleTwentyDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_20,
  paddleFiftyDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_50,
  paddleHundredDollarPriceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_100,
  paddleWebhookSecretKey: process.env.PADDLE_WEBHOOK_SECRET_KEY,
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
