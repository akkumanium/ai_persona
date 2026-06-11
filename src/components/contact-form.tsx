"use client";

import { Loader2, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "sent" | "error";

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setState("submitting");
    setFeedback("");

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
        company: formData.get("company"),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setState("error");
      setFeedback(payload.error ?? "Something went wrong. Please try again.");
      return;
    }

    form.reset();
    setState("sent");
    setFeedback("Your letter was sent. Thank you.");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-[#f4dcea]">
        Your name
        <input
          name="name"
          required
          maxLength={120}
          className="h-11 rounded-md border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition placeholder:text-[#9fa6b8] focus:border-[#ff4fa3]"
          placeholder="Name"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#f4dcea]">
        Gmail, optional
        <input
          name="email"
          type="email"
          maxLength={240}
          className="h-11 rounded-md border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition placeholder:text-[#9fa6b8] focus:border-[#ff4fa3]"
          placeholder="you@gmail.com"
        />
      </label>

      <label className="hidden">
        Company
        <input name="company" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#f4dcea]">
        Letter
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={7}
          className="resize-y rounded-md border border-white/12 bg-white/[0.07] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[#9fa6b8] focus:border-[#ff4fa3]"
          placeholder="Write your note to the developer..."
        />
      </label>

      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff4fa3] px-4 text-sm font-semibold text-[#120913] shadow-[0_16px_38px_rgba(255,79,163,0.22)] transition hover:bg-[#ff77b8] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state === "submitting" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        Send letter
      </button>

      {feedback ? (
        <p className={`text-sm leading-6 ${state === "error" ? "text-[#ff9cae]" : "text-[#ffd0e7]"}`}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
