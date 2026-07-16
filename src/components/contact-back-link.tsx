"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ContactBackLink() {
  const returnToStudio = useSearchParams().get("from") === "studio";

  return (
    <Link
      href={returnToStudio ? "/studio" : "/"}
      className="mb-8 inline-flex w-fit items-center gap-2 rounded-md border border-white/[0.14] bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white transition hover:border-[#ff4fa3]/70 hover:bg-white/[0.12]"
    >
      <ArrowLeft size={17} />
      {returnToStudio ? "Back to Studio" : "Main page"}
    </Link>
  );
}
