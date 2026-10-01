import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

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
    <Link href={`/events/${e.id}`} className="card block overflow-hidden transition hover:shadow-md" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="badge">{e.category}</span>
          {live && <span className="badge border-green-500/40 text-green-600 dark:text-green-400">Happening now</span>}
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
