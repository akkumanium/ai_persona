import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { PublicHeader } from "@/components/public-header";
import { env, hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Contact | Persona Studio",
  description: "Send a short letter to the Persona Studio developer.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const returnToStudio = from === "studio";
  const supabaseReady = hasSupabaseEnv();
  let initialUserEmail: string | undefined;

  if (supabaseReady) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialUserEmail = user?.email;
  }

  return (
    <main className="public-page px-5 py-8 text-white sm:px-8">
      <PublicHeader initialUserEmail={initialUserEmail} supabaseReady={supabaseReady} redirectPath="/contact" />
      <div className="public-content mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <Link
          href={returnToStudio ? "/studio" : "/"}
          className="mb-8 inline-flex w-fit items-center gap-2 rounded-md border border-white/[0.14] bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white transition hover:border-[#ff4fa3]/70 hover:bg-white/[0.12]"
        >
          <ArrowLeft size={17} />
          {returnToStudio ? "Back to Studio" : "Main page"}
        </Link>

        <div className="grid gap-8 rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur sm:p-7">
          <div>
            <div className="flex size-11 items-center justify-center rounded-md border border-[#ff4fa3]/32 bg-[#ff4fa3]/14 text-[#ff8fc7]">
              <Mail size={21} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal sm:text-4xl">Contact us</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b6bacb]">
              Report any bugs, mistakes, or suggestions you have. The site is in its early stage, so your feedback is greatly appreciated. You can also write directly to {" "}
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
