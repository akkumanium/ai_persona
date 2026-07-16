"use client";

import { useEffect, useMemo, useState } from "react";
import { BillingManagement } from "@/components/billing-management";
import { BillingPlans } from "@/components/billing-plans";
import type { PublicBillingConfig } from "@/lib/billing";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type PricingUser = { id: string; email?: string };

export function PricingAccount({
  supabaseReady,
  config,
}: {
  supabaseReady: boolean;
  config: PublicBillingConfig;
}) {
  const supabase = useMemo(
    () => (supabaseReady ? createBrowserSupabaseClient() : null),
    [supabaseReady],
  );
  const [user, setUser] = useState<PricingUser>();
  const [authResolved, setAuthResolved] = useState(!supabaseReady);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : undefined);
      setAuthResolved(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (!authResolved) {
    return <div className="mx-auto min-h-64 max-w-5xl px-5 pb-20 sm:px-8" aria-label="Loading account" />;
  }

  return (
    <div className="pb-20">
      <BillingPlans
        title={user ? "Choose your subscription" : "Sign in, then subscribe"}
        copy={
          user
            ? "Pay $12 monthly or save with the $80 yearly subscription. Both include limitless personas and one-time welcome credits."
            : "Authentication connects the Whop payment to your workspace before checkout."
        }
        userId={user?.id}
        userEmail={user?.email}
        supabaseReady={supabaseReady}
        config={config}
        compact
        theme="dark"
      />
      {user ? (
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <BillingManagement dark />
        </div>
      ) : null}
    </div>
  );
}
