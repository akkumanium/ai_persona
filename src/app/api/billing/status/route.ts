import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getBillingAccess } from "@/lib/server/billing-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase is not configured.", hasStudioAccess: false, balanceCents: 0 },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Authentication is required.", hasStudioAccess: false, balanceCents: 0 },
      { status: 401 },
    );
  }

  const access = await getBillingAccess(supabase, user.id);
  return NextResponse.json(access);
}
