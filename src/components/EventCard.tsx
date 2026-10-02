import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { TintBadge } from "@/components/ui";

export type EventCardData = {
  id: string;
  title: string;
  category: string;
  venue: string | null;
  starts_at: string;
  clubs: { name: string; slug: string; accent_color: string } | null;
};

export function EventCard({ e, showClub = true, live = false }: { e: EventCardData; showClub?: boolean; live?: boolean }) {
  const accent = e.clubs?.accent_color ?? "#4f46e5";
  return (
    <Link href={`/events/${e.id}`} className="card block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderTop: `3px solid ${accent}`, background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 9%, var(--surface)), var(--surface) 60%)` }}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <TintBadge>{e.category}</TintBadge>
          {live && <span className="badge border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300">Happening now</span>}
        </span>
        <time dateTime={e.starts_at}>{fmtDateTime(e.starts_at)}</time>
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{e.title}</h3>
      <p className="mt-1 text-sm text-muted">
        {showClub && e.clubs ? e.clubs.name : ""}
        {showClub && e.clubs && e.venue ? " · " : ""}
        {e.venue ?? ""}
      </p>
    </Link>
  );
}
