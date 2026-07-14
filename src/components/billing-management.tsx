"use client";

import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTokens } from "@/lib/utils";

type RefundStatus = { eligible: boolean; reason: string; amountCents: number };

export function BillingManagement({ dark = false }: { dark?: boolean }) {
  const [busy, setBusy] = useState<"portal" | "refund">();
  const [refund, setRefund] = useState<RefundStatus>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/billing/refund", { cache: "no-store" })
      .then(readJson)
      .then((payload) => setRefund(payload as RefundStatus))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Refund eligibility could not be checked."));
  }, []);

  async function openPortal() {
    setBusy("portal");
    setMessage("");
    try {
      const payload = await readJson(await fetch("/api/billing/portal", { method: "POST" })) as { url?: string };
      if (!payload.url) throw new Error("The billing portal did not return a link.");
      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing management could not be opened.");
      setBusy(undefined);
    }
  }

  async function requestRefund() {
    if (!refund?.eligible || !window.confirm(`Request a full refund of ${formatTokens(refund.amountCents)}? Your subscription credits will be removed.`)) return;
    setBusy("refund");
    setMessage("");
    try {
      const payload = await readJson(await fetch("/api/billing/refund", { method: "POST" })) as { message?: string };
      setMessage(payload.message ?? "Refund submitted.");
      setRefund((current) => current ? { ...current, eligible: false, reason: "A refund has already been submitted for this payment." } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The refund could not be submitted.");
    } finally {
      setBusy(undefined);
    }
  }

  const shell = dark
    ? "border-white/10 bg-white/[0.055] text-white"
    : "border-stone-200 bg-white text-stone-950";
  const muted = dark ? "text-[#aeb4c6]" : "text-stone-600";
  const secondary = dark
    ? "border-white/15 bg-white/10 text-white hover:border-[#ff4fa3]/70"
    : "border-stone-200 bg-white text-stone-800 hover:border-emerald-800";

  return (
    <section className={`rounded-lg border p-5 shadow-sm ${shell}`}>
      <h2 className="text-xl font-semibold">Manage membership</h2>
      <p className={`mt-2 text-sm leading-6 ${muted}`}>Cancel or update your membership securely in Whop. Whop may ask you to sign in before showing billing details.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => void openPortal()} disabled={Boolean(busy)} className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition disabled:opacity-60 ${secondary}`}>
          {busy === "portal" ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
          Manage or cancel membership
        </button>
        <button type="button" onClick={() => void requestRefund()} disabled={!refund?.eligible || Boolean(busy)} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] transition hover:bg-[#ff77b8] disabled:cursor-not-allowed disabled:opacity-45">
          {busy === "refund" ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
          Request unused-credit refund
        </button>
      </div>
      <p className={`mt-4 text-sm leading-6 ${muted}`}>
        {refund ? refund.reason : "Checking whether your latest subscription payment is refundable…"}
      </p>
      {message ? <p className={`mt-3 text-sm font-medium ${dark ? "text-[#ffd0e7]" : "text-emerald-800"}`}>{message}</p> : null}
    </section>
  );
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}
