import type { User } from "@supabase/supabase-js";

import { hasSupabaseEnv } from "@/lib/env";
import { isGuideAdmin } from "@/lib/guide-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/server/billing-access";

export type GuideViewerAccess = {
  supabaseReady: boolean;
  user: User | null;
  userId?: string;
  userEmail?: string;
  canManage: boolean;
  hasActiveSubscription: boolean;
  hasGuideAccess: boolean;
};

export async function getGuideViewerAccess(): Promise<GuideViewerAccess> {
  const supabaseReady = hasSupabaseEnv();

  if (!supabaseReady) {
    return emptyGuideAccess(false);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return emptyGuideAccess(true);
  }

  const canManage = isGuideAdmin(user);
  const billingAccess = await getBillingAccess(supabase, user.id);
  const hasActiveSubscription = billingAccess.hasActiveSubscription;

  return {
    supabaseReady,
    user,
    userId: user.id,
    userEmail: user.email,
    canManage,
    hasActiveSubscription,
    hasGuideAccess: canManage || hasActiveSubscription,
  };
}

function emptyGuideAccess(supabaseReady: boolean): GuideViewerAccess {
  return {
    supabaseReady,
    user: null,
    canManage: false,
    hasActiveSubscription: false,
    hasGuideAccess: false,
  };
}
