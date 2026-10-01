"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Events", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/quellen", label: "Quellen", icon: "M12 3v18M3 12h18M6 6l12 12M18 6 6 18" },
  { href: "/einstellungen", label: "Einstellungen", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2" },
];

export function BottomNav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t border-line safe-bottom">
      <ul className="mx-auto max-w-xl grid grid-cols-3">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" || path.startsWith("/events") : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-1 text-xs ${active ? "text-felt font-bold" : "text-muted"}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
