import { NextResponse } from "next/server";
import { requireUserWhenSupabaseIsConfigured } from "@/lib/auth";
import { env } from "@/lib/env";
import { rateLimitRequest, readJsonRequest, requestBodyErrorResponse } from "@/lib/server/request-security";
import { mapPersona } from "@/lib/studio-records";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Persona } from "@/lib/types";

type PersonaInsertPayload = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  styleNotes?: unknown;
  status?: unknown;
  referenceAssetId?: unknown;
  createdAt?: unknown;
};

type PersonaRow = {
  id: string;
  name: string;
  description: string;
  style_notes: string;
  status: Persona["status"];
  reference_asset_id: string | null;
  created_at: string;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, { key: "personas", limit: 30, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const auth = await requireUserWhenSupabaseIsConfigured();
  if (auth.response) return auth.response;
  if (!auth.user) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await readJsonRequest(request, 64 * 1024);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const input = validatePersonaPayload(payload as PersonaInsertPayload);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const supabase = env.supabaseServiceRoleKey
    ? createServiceSupabaseClient()
    : await createServerSupabaseClient();

  if (input.persona.referenceAssetId) {
    const { data: referenceAsset } = await supabase
      .from("assets")
      .select("id")
      .eq("id", input.persona.referenceAssetId)
      .eq("user_id", auth.user.id)
      .maybeSingle<{ id: string }>();
    if (!referenceAsset) {
      return NextResponse.json({ error: "Reference asset is outside the current user scope." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("personas")
    .insert({
      id: input.persona.id,
      user_id: auth.user.id,
      name: input.persona.name,
      description: input.persona.description,
      style_notes: input.persona.styleNotes,
      status: input.persona.status,
      reference_asset_id: input.persona.referenceAssetId ?? null,
      created_at: input.persona.createdAt,
    })
    .select("id, name, description, style_notes, status, reference_asset_id, created_at")
    .single<PersonaRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json({ persona: mapPersona(data) });
}

function validatePersonaPayload(payload: PersonaInsertPayload): { persona: Persona } | { error: string } {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const styleNotes = typeof payload.styleNotes === "string" ? payload.styleNotes.trim() : "";
  const status = payload.status === "draft" || payload.status === "archived" ? payload.status : "active";
  const id = typeof payload.id === "string" && payload.id ? payload.id : crypto.randomUUID();
  const createdAt = typeof payload.createdAt === "string" && payload.createdAt ? payload.createdAt : new Date().toISOString();
  const referenceAssetId =
    typeof payload.referenceAssetId === "string" && payload.referenceAssetId ? payload.referenceAssetId : undefined;

  if (!name) return { error: "Persona name is required." };
  if (!description) return { error: "Persona description is required." };

  return {
    persona: {
      id,
      name,
      description,
      styleNotes,
      status,
      referenceAssetId,
      createdAt,
    },
  };
}
