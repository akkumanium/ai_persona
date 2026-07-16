"use client";

import {
  BadgeCheck,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup";
const policyVersion = "2026-07-16";

export function AuthButton({
  initialUserEmail,
  supabaseReady,
  variant = "light",
  defaultOpen = false,
  redirectPath = "/studio",
  referralCode = "",
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
  variant?: "light" | "dark";
  defaultOpen?: boolean;
  redirectPath?: string;
  referralCode?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [userEmail, setUserEmail] = useState(initialUserEmail ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [acknowledgesAiProcessing, setAcknowledgesAiProcessing] = useState(false);
  const userEmailRef = useRef(initialUserEmail ?? "");

  const supabase = useMemo(
    () => (supabaseReady ? createBrowserSupabaseClient() : null),
    [supabaseReady],
  );

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextEmail = session?.user.email ?? "";
      const identityChanged = nextEmail !== userEmailRef.current;
      userEmailRef.current = nextEmail;
      setUserEmail(nextEmail);

      // INITIAL_SESSION fires when the listener is registered, and SIGNED_IN
      // may fire again when a tab regains focus. Neither should cause an extra
      // RSC request unless the authenticated identity actually changed.
      if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED" && identityChanged) {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [initialUserEmail, router, supabase]);

  async function signInWithGoogle() {
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }

    setError("");
    setStatus("");
    if (!hasAcceptedSignupRequirements()) return;
    setIsSubmitting(true);

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", redirectPath);
    callbackUrl.searchParams.set("terms_version", policyVersion);
    callbackUrl.searchParams.set("signup_acknowledged", "true");
    if (referralCode) callbackUrl.searchParams.set("ref", referralCode);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }

    setError("");
    setStatus("");
    if (mode === "signup" && !hasAcceptedSignupRequirements()) return;
    setIsSubmitting(true);

    const credentials = {
      email: email.trim(),
      password,
    };

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`,
              data: {
                ...(referralCode ? { referral_code: referralCode } : {}),
                terms_version: policyVersion,
                terms_accepted_at: new Date().toISOString(),
                privacy_policy_acknowledged_at: new Date().toISOString(),
                ai_processing_acknowledged_at: new Date().toISOString(),
                age_confirmed_at: new Date().toISOString(),
              },
            },
          });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setStatus("Check your email to confirm your account, then sign in.");
      return;
    }

    if (mode === "signup" && referralCode) {
      await fetch("/api/referrals/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode }),
      }).catch(() => undefined);
    }

    setIsOpen(false);
    setEmail("");
    setPassword("");
    router.push(redirectPath);
    router.refresh();
  }

  async function signOut() {
    if (!supabase) return;

    setIsSubmitting(true);
    await supabase.auth.signOut();
    setIsSubmitting(false);
    setUserEmail("");
    router.refresh();
  }

  function hasAcceptedSignupRequirements() {
    if (isAdult && acceptsTerms && acknowledgesAiProcessing) return true;
    setError("Confirm your age, acceptance of the Terms and Privacy Policy, and AI processing before continuing.");
    return false;
  }

  const accountClass =
    variant === "dark"
      ? "inline-flex h-11 items-center gap-2 rounded-md border border-[#ffffff1f] bg-[#ffffff12] px-4 text-sm font-semibold text-white transition hover:border-[#ff4fa3] hover:bg-[#ffffff1c]"
      : "inline-flex h-11 items-center gap-2 rounded-md border border-[#e6c9d8] bg-white px-4 text-sm font-semibold text-[#19141a] transition hover:border-[#c22f75]";
  const primaryClass =
    variant === "dark"
      ? "inline-flex h-11 items-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] shadow-[0_14px_34px_rgba(255,79,163,0.24)] transition hover:bg-[#ff77b8] disabled:cursor-not-allowed disabled:opacity-70"
      : "inline-flex h-11 items-center gap-2 rounded-md bg-[#19141a] px-4 text-sm font-semibold text-white transition hover:bg-[#35242f] disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="relative">
      {userEmail ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a
            href="/studio"
            className={accountClass}
          >
            <ShieldCheck size={17} />
            Account
          </a>
          <button
            type="button"
            onClick={signOut}
            disabled={isSubmitting}
            className={primaryClass}
          >
            {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={primaryClass}
        >
          <LogIn size={17} />
          Sign in
        </button>
      )}

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/64 px-4 py-6 sm:items-center">
              <div className="my-auto w-full max-w-md rounded-lg border border-[#ffffff24] bg-[#10151d] p-5 text-white shadow-2xl shadow-black/45 sm:max-h-[calc(100vh-3rem)] sm:overflow-y-auto">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">Idolborn access</p>
                    <p className="mt-1 text-sm leading-6 text-[#d7dfeb]">
                      Sign in to keep account data, assets, and token usage tied to your Supabase user.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#ffffff1f] text-[#c8d4e5] transition hover:text-white"
                    aria-label="Close authentication dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                {!supabaseReady ? (
                  <div className="mt-5 rounded-md border border-[#f7c95f55] bg-[#f7c95f12] p-4 text-sm leading-6 text-[#ffe7aa]">
                    Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before using authentication.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid grid-cols-2 rounded-md border border-[#ffffff1f] bg-[#0d1219] p-1">
                      <button
                        type="button"
                        onClick={() => setMode("signin")}
                        className={`h-10 rounded text-sm font-semibold transition ${
                          mode === "signin" ? "bg-[#f8fbff] text-[#10151d]" : "text-[#e3e9f4]"
                        }`}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className={`h-10 rounded text-sm font-semibold transition ${
                          mode === "signup" ? "bg-[#f8fbff] text-[#10151d]" : "text-[#e3e9f4]"
                        }`}
                      >
                        Sign up
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      disabled={isSubmitting}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#f8fbff] px-4 text-sm font-semibold text-[#10151d] transition hover:bg-[#edf3f8] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />}
                      Continue with Google
                    </button>

                    <div className="mt-4 grid gap-3 rounded-md border border-[#ffffff1f] bg-[#ffffff08] p-3 text-left text-xs leading-5 text-[#d7dfeb]">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input type="checkbox" checked={isAdult} onChange={(event) => setIsAdult(event.target.checked)} className="mt-1 size-3.5 accent-[#ff4fa3]" />
                        <span>I confirm that I am at least 18 years old.</span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input type="checkbox" checked={acceptsTerms} onChange={(event) => setAcceptsTerms(event.target.checked)} className="mt-1 size-3.5 accent-[#ff4fa3]" />
                        <span>I agree to the <Link href="/terms" target="_blank" className="text-[#ffd0e7] underline">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-[#ffd0e7] underline">Privacy Policy</Link>.</span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input type="checkbox" checked={acknowledgesAiProcessing} onChange={(event) => setAcknowledgesAiProcessing(event.target.checked)} className="mt-1 size-3.5 accent-[#ff4fa3]" />
                        <span>I understand that prompts, uploads, and generation instructions are sent to WaveSpeedAI or ElevenLabs to provide requested AI generations.</span>
                      </label>
                    </div>

                    <form onSubmit={handleEmailAuth} className="mt-4 grid gap-3">
                      <label className="grid gap-1.5 text-sm font-semibold text-[#dce8f7]">
                        Email
                        <span className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8090a3]" size={17} />
                          <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                            className="h-11 w-full rounded-md border border-[#ffffff24] bg-[#ffffff14] px-10 text-sm text-white outline-none transition placeholder:text-[#97a6ba] focus:border-[#ff4fa3]"
                            placeholder="you@example.com"
                          />
                        </span>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-[#dce8f7]">
                        Password
                        <span className="relative">
                          <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8090a3]" size={17} />
                          <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            minLength={6}
                            className="h-11 w-full rounded-md border border-[#ffffff24] bg-[#ffffff14] px-10 text-sm text-white outline-none transition placeholder:text-[#97a6ba] focus:border-[#ff4fa3]"
                            placeholder="At least 6 characters"
                          />
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] transition hover:bg-[#ff77b8] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSubmitting ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : mode === "signin" ? (
                          <LogIn size={17} />
                        ) : (
                          <UserPlus size={17} />
                        )}
                        {mode === "signin" ? "Sign in with email" : "Create account"}
                      </button>
                    </form>

                    {status ? <p className="mt-4 text-sm leading-6 text-[#ffd0e7]">{status}</p> : null}
                    {error ? <p className="mt-4 text-sm leading-6 text-[#ff9cae]">{error}</p> : null}
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
