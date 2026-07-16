/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Idolborn",
  description: "How Idolborn collects, uses, and protects personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: July 16, 2026</p>

      <h2>1. Who we are and how to contact us</h2>
      <p>
        Idolborn is operated by Ilyas Amangeldiyev, an individual software creator based in Kazakhstan, trading as "Idolborn" ("Idolborn", "we", "us", or "our"). Our address is Roza Baglanova Street 4, Astana, Kazakhstan. For privacy questions or requests, email <a href="mailto:idolborn.support@gmail.com">idolborn.support@gmail.com</a>.
      </p>
      <p>
        This Privacy Policy explains how we process personal data when you use Idolborn. It does not cover independent processing by third-party services, including Whop, Supabase, WaveSpeedAI, and ElevenLabs, which is governed by their own notices and terms.
      </p>

      <h2>2. Personal data we collect</h2>
      <p>
        We collect data you provide or create through the Service: account information such as email address, account identifier, display name, profile image, and authentication information; persona names, descriptions, and style notes; prompts and generation settings; uploaded images, video, and audio; generated assets; and support communications you email to us.
      </p>
      <p>
        We also process Service and transaction information: generation-job and provider identifiers, status, model and settings, asset metadata, credit balances and ledger entries, referral information, subscription and membership status, checkout and payment identifiers, refund or dispute information, and limited billing-event records received from Whop. We do not receive or store full payment-card numbers.
      </p>
      <p>
        Our providers and hosting infrastructure may automatically process technical data such as IP address, device or browser information, request and security logs, session identifiers, timestamps, and error or fraud-prevention information. We do not intentionally use an advertising pixel, behavioral analytics SDK, or custom tracking cookie in Idolborn.
      </p>

      <h2>3. Why we use personal data</h2>
      <p>
        We use personal data to create and secure accounts; provide, personalize, and maintain the Service; process requested AI generations; store and retrieve your media; manage subscriptions, credits, refunds, and disputes; communicate with you; prevent fraud, abuse, and security incidents; enforce our <Link href="/terms">Terms of Service</Link>; comply with legal obligations; and establish, exercise, or defend legal claims.
      </p>
      <p>
        Where consent is required, we rely on your consent. Otherwise, we process data as needed to provide the Service you request, meet legal obligations, protect the Service and users, or pursue our legitimate interests in operating a secure and reliable service, as applicable under law.
      </p>

      <h2>4. AI generation and service providers</h2>
      <p>
        When you request a generation, we send the relevant prompts, selected or uploaded images, audio, video, media URLs, and generation instructions to the provider needed to fulfill that request. WaveSpeedAI processes image, video, and avatar-generation requests. ElevenLabs processes text and voice settings for speech-generation requests. These providers may use subprocessors or underlying models. We do not use your prompts, uploads, generated media, or voices to train Idolborn's own AI models.
      </p>
      <p>
        We use Supabase for authentication, database, session functionality, and private media storage. We use Whop for checkout, subscriptions, payment-related services, membership management, refunds, and billing webhooks. Whop may appear on your payment statement and processes payment data under its own policies. We disclose data to providers only as needed for the purposes described in this Policy, to comply with law, or to protect rights and safety.
      </p>

      <h2>5. Sharing and international transfers</h2>
      <p>
        We share personal data with service providers that process it for us or with us, including Supabase, WaveSpeedAI, ElevenLabs, Whop, and infrastructure providers. We may also disclose data to professional advisers, regulators, law enforcement, or other parties when required by law, necessary to protect rights or safety, or in connection with a business transfer. We do not sell personal data or disclose it for cross-context behavioral advertising.
      </p>
      <p>
        Our providers may process data in countries other than yours. Where required, we will use appropriate safeguards for such transfers. The protections and laws of the destination country may differ from those where you live.
      </p>

      <h2>6. Retention</h2>
      <p>
        We retain account information, personas, generation records, and stored assets while your account remains active or as needed to provide the Service. Active temporary uploaded and generated media controlled by Idolborn is scheduled for deletion after seven days; download assets you want to retain. Deleting an asset or account removes relevant active data where reasonably possible, but deletion may not be immediate.
      </p>
      <p>
        We may retain limited data for longer where needed for billing, refunds, disputes, fraud prevention, security, legal obligations, or the establishment, exercise, or defense of legal claims. Backup and security-log copies may persist until they are overwritten or expire under the applicable provider's retention cycle. Third-party providers may retain data under their own policies and settings.
      </p>

      <h2>7. Cookies and similar technologies</h2>
      <p>
        Idolborn uses essential authentication and session technologies supplied through Supabase to keep you signed in and protect the Service. We do not intentionally deploy our own advertising or behavioral analytics cookies. Whop and other providers may use cookies, pixels, JavaScript, or similar technologies when you use their services, including checkout. Where legally required for non-essential technologies, we will seek consent before they are used.
      </p>

      <h2>8. Your choices and privacy rights</h2>
      <p>
        Depending on where you live, you may have rights to request access to, correction of, deletion of, export of, restriction of, or objection to certain processing of your personal data, and to withdraw consent where processing relies on consent. To make a request, email <a href="mailto:idolborn.support@gmail.com">idolborn.support@gmail.com</a> from your account email and describe your request. We may ask for information reasonably necessary to verify your identity and authority.
      </p>
      <p>
        Requests may cover data controlled directly by Idolborn, such as your account details, personas, stored media, and generation records. Payment and billing data controlled by Whop may need to be requested directly from Whop. We may decline or limit a request where permitted by law, including to protect others' rights or meet legal, billing, fraud-prevention, security, or recordkeeping obligations. You may also have the right to complain to your local data-protection authority.
      </p>

      <h2>9. Security</h2>
      <p>
        We use reasonable technical and organizational measures designed to protect personal data. For example, media storage is configured as private and access-controlled. No system is completely secure, and we cannot guarantee absolute security. Keep your account credentials confidential and notify us promptly if you suspect unauthorized account access.
      </p>

      <h2>10. Children</h2>
      <p>
        Idolborn is not for anyone under 18. We do not knowingly collect personal data from children. If you believe a child has provided personal data to us, contact us so that we can take appropriate action.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version on this page and revise the "Last updated" date. When required by law, we will provide additional notice or seek consent for material changes.
      </p>
    </LegalPage>
  );
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-stone-50 px-5 py-14 text-stone-800"><article className="mx-auto max-w-3xl rounded-xl border border-stone-200 bg-white p-7 shadow-sm [&_a]:text-emerald-800 [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_p]:leading-7"><Link href="/" className="text-sm font-semibold">Back to home</Link><h1 className="mt-6 text-3xl font-semibold text-stone-950">{title}</h1>{children}</article></main>;
}
