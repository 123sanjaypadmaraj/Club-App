"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = isAdmin
    ? [
        { href: "/dashboard", label: "Overview", match: (p: string) => p === "/dashboard" },
        { href: "/dashboard/clubs", label: "Clubs", match: (p: string) => p.startsWith("/dashboard/clubs") },
        { href: "/dashboard/leads", label: "Club leads", match: (p: string) => p.startsWith("/dashboard/leads") },
      ]
    : [{ href: "/dashboard", label: "My clubs", match: (p: string) => p.startsWith("/dashboard") && !p.startsWith("/dashboard/account") }];
  items.push({ href: "/dashboard/account", label: "Account", match: (p: string) => p.startsWith("/dashboard/account") });
  return (
    <nav className="mb-6 flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`rounded-md px-3 py-1.5 font-medium ${i.match(path) ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
