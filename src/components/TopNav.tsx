"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  href: string;
  label: string;
}

export function TopNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-fg">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
            T
          </span>
          <span className="hidden sm:inline">TOEFL Tutor</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-lg px-3 py-1.5 font-medium transition-colors " +
                  (active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-fg")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
