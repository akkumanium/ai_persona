"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";

const TELEGRAM_GROUP_URL = "https://t.me/personastudioai";

export function PublicHeader({
  initialUserEmail,
  supabaseReady,
  redirectPath,
}: {
  initialUserEmail?: string;
  supabaseReady: boolean;
  redirectPath?: string;
}) {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <div className="site-nav-inner">
        <Link href="/" className="site-brand">
          <Image src="/favicon.svg" alt="" width={28} height={28} className="site-brand-mark" />
          <span>Persona studio</span>
        </Link>
        <div className="site-nav-links">
          <Link href="/guides">Guides</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/faq">FAQ</Link>
          <a href={TELEGRAM_GROUP_URL} target="_blank" rel="noreferrer" className="site-telegram-link" aria-label="Telegram">
            <TelegramIcon />
          </a>
        </div>
        <div className="site-nav-actions">
          <AuthButton
            initialUserEmail={initialUserEmail}
            supabaseReady={supabaseReady}
            variant="dark"
            redirectPath={redirectPath}
          />
        </div>
      </div>
    </nav>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="site-telegram-icon">
      <path
        fill="currentColor"
        d="M21.7 4.4c.3-1.1-.7-2-1.7-1.6L2.9 9.4c-1.2.5-1.2 2.1.1 2.5l4.4 1.4 1.7 5.4c.4 1.1 1.8 1.4 2.5.5l2.4-3 4.7 3.5c.9.7 2.2.2 2.4-.9l3-14.4ZM8 12.2l9.7-6.1c.4-.2.8.3.5.6l-7.9 7.1-.3 3.3-1.1-3.5-.9-1.4Z"
      />
    </svg>
  );
}
