import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, hasSupabaseEnv } from "@/lib/env";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Write your name.").max(120, "Name is too long."),
  email: z
    .string()
    .trim()
    .max(240, "Email is too long.")
    .optional()
    .transform((value) => value ?? "")
    .refine((value) => !value || z.email().safeParse(value).success, "Use a valid email."),
  message: z.string().trim().min(10, "Write a little more.").max(4000, "Letter is too long."),
  company: z.string().trim().max(0).optional(),
});

export async function POST(request: NextRequest) {
  const rateLimited = rateLimitRequest(request, { key: "contact", limit: 5, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await readJsonRequest(request, 32 * 1024);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  const { name, email, message } = parsed.data;

  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Contact storage is not configured yet." },
      { status: 503 },
    );
  }

  const supabase = env.supabaseServiceRoleKey
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();

  const { error } = await supabase.from("contact_messages").insert({
    name,
    email: email || null,
    message,
    user_agent: request.headers.get("user-agent"),
    page_url: request.headers.get("referer"),
  });

  if (error) {
    return NextResponse.json(
      { error: "I could not save your letter yet. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
