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
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup";

export function AuthButton({
  initialUserEmail,
  supabaseReady,
  variant = "light",
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [userEmail, setUserEmail] = useState(initialUserEmail ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = useMemo(
    () => (supabaseReady ? createBrowserSupabaseClient() : null),
    [supabaseReady],
  );

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? initialUserEmail ?? "");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? "");
      router.refresh();
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
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/studio`,
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
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/studio`,
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

    setIsOpen(false);
    setEmail("");
    setPassword("");
    router.push("/studio");
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

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/64 px-4 py-6">
          <div className="w-full max-w-md rounded-lg border border-[#ffffff24] bg-[#10151d] p-5 text-white shadow-2xl shadow-black/45">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Persona Studio access</p>
                <p className="mt-1 text-sm leading-6 text-[#b9c4d3]">
                  Sign in to keep account data, assets, and credit usage tied to your Supabase user.
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
                <div className="mt-5 grid grid-cols-2 rounded-md border border-[#ffffff1f] p-1">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className={`h-10 rounded text-sm font-semibold transition ${
                      mode === "signin" ? "bg-white text-[#10151d]" : "text-[#c8d4e5]"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={`h-10 rounded text-sm font-semibold transition ${
                      mode === "signup" ? "bg-white text-[#10151d]" : "text-[#c8d4e5]"
                    }`}
                  >
                    Sign up
                  </button>
                </div>

                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={isSubmitting}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#10151d] transition hover:bg-[#edf3f8] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <BadgeCheck size={17} />}
                  Continue with Google
                </button>

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
                        className="h-11 w-full rounded-md border border-[#ffffff1f] bg-[#ffffff0c] px-10 text-sm text-white outline-none transition placeholder:text-[#8090a3] focus:border-[#25c4a4]"
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
                        className="h-11 w-full rounded-md border border-[#ffffff1f] bg-[#ffffff0c] px-10 text-sm text-white outline-none transition placeholder:text-[#8090a3] focus:border-[#25c4a4]"
                        placeholder="At least 6 characters"
                      />
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#25c4a4] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-[#38d9b7] disabled:cursor-not-allowed disabled:opacity-70"
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

                {status ? <p className="mt-4 text-sm leading-6 text-[#8fd067]">{status}</p> : null}
                {error ? <p className="mt-4 text-sm leading-6 text-[#ff9cae]">{error}</p> : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
