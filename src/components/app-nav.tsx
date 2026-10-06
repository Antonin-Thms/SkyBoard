"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/documents", label: "Documents" },
  { href: "/cockpits", label: "Cockpits" },
  { href: "/remote", label: "Remote" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
