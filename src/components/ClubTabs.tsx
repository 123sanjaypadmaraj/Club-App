"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "", label: "Overview" },
  { key: "events", label: "Events" },
  { key: "members", label: "Members" },
  { key: "announcements", label: "Announcements" },
  { key: "settings", label: "Settings" },
];

export function ClubTabs({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/dashboard/clubs/${slug}`;
  const current = path === base ? "" : path.slice(base.length + 1).split("/")[0];
  return (
    <nav className="mb-6 flex gap-1 print:hidden overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.key ? `${base}/${t.key}` : base}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${current === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
