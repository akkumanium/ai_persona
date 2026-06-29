"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthButton } from "@/components/auth/auth-button";

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
          <span>persona/studio</span>
        </Link>
        <div className="site-nav-links">
          <Link href="/guides">Guides</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/faq">FAQ</Link>
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
