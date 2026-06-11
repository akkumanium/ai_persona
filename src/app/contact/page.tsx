import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { env } from "@/lib/env";

export const metadata = {
  title: "Contact | Persona Studio",
  description: "Send a short letter to the Persona Studio developer.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#070711] px-5 py-8 text-white sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_12%,rgba(255,79,163,0.2),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(116,92,246,0.16),transparent_28%),linear-gradient(135deg,#070711_0%,#0b0d1b_48%,#160b1f_100%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <Link
          href="/"
          className="mb-8 inline-flex w-fit items-center gap-2 rounded-md border border-white/[0.14] bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white transition hover:border-[#ff4fa3]/70 hover:bg-white/[0.12]"
        >
          <ArrowLeft size={17} />
          Main page
        </Link>

        <div className="grid gap-8 rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur sm:p-7">
          <div>
            <div className="flex size-11 items-center justify-center rounded-md border border-[#ff4fa3]/32 bg-[#ff4fa3]/14 text-[#ff8fc7]">
              <Mail size={21} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal sm:text-4xl">Contact us</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b6bacb]">
              Send a short letter to the developer. You can also write directly to{" "}
              <a className="font-semibold text-[#ffd0e7] hover:text-white" href={`mailto:${env.contactEmail}`}>
                {env.contactEmail}
              </a>
              .
            </p>
          </div>

          <ContactForm />
        </div>
      </div>
    </main>
  );
}
