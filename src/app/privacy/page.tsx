import Link from "next/link";

export const metadata = { title: "Privacy | Idolborn", description: "How Idolborn processes account, billing, and generated-media data." };

export default function PrivacyPage() {
  return <LegalPage title="Privacy notice">
    <p>Last updated: July 12, 2026.</p>
    <h2>Data we process</h2>
    <p>Idolborn stores your account identifier and email, persona details, prompts, uploaded reference media, generated assets, generation history, token ledger, referral records, and billing entitlement state. Authentication, database records, and private media storage are provided by Supabase.</p>
    <h2>Service providers</h2>
    <p>Generation inputs are sent only to the provider selected for the requested operation, currently WaveSpeed and ElevenLabs. Paddle processes checkout, subscription, refund, and customer-portal activity; Idolborn does not receive full payment-card details. Vercel hosts the application.</p>
    <h2>Use, retention, and disclosure</h2>
    <p>We use data to authenticate you, provide generations, enforce plans and quotas, prevent abuse, reconcile payments, respond to support, and diagnose failures. Private media is disclosed to generation providers only as needed to perform your request. Records are retained while your account is active and as required for billing, fraud prevention, security, and legal obligations.</p>
    <h2>Your choices</h2>
    <p>You may cancel billing through the customer portal. To request access, correction, export, or deletion of account data and stored media, use the <Link href="/contact">contact form</Link>. Some billing and security records may need to be retained where legally required.</p>
  </LegalPage>;
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-800"><article className="mx-auto max-w-3xl rounded-xl border border-stone-200 bg-white p-7 shadow-sm [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_p]:leading-7"><Link href="/" className="text-sm font-semibold text-emerald-800">← Home</Link><h1 className="mt-6 text-3xl font-semibold text-stone-950">{title}</h1>{children}</article></main>;
}
