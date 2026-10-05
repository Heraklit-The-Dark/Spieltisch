"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Zurück zur vorherigen Liste (z. B. zu den Suchtreffern), sonst zur Übersicht. */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onClick={(ev) => {
        if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
          ev.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-1 text-sm text-muted h-10"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Zurück
    </Link>
  );
}
