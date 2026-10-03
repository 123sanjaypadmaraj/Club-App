/** Normalised site origin from NEXT_PUBLIC_SITE_URL, or null when unset/invalid. */
export function siteOrigin(raw: string | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export type SitemapEntry = { url: string; lastModified?: Date };

const RECENT_DAYS = 180;

/** Whether an event is recent/upcoming enough to belong in the sitemap. */
export function eventInSitemapWindow(startsAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(startsAt);
  return Number.isFinite(t) && t >= now.getTime() - RECENT_DAYS * 86_400_000;
}

export function buildSitemap(
  origin: string | null,
  clubs: { slug: string }[],
  events: { id: string; starts_at: string; created_at?: string | null }[],
  now: Date = new Date(),
): SitemapEntry[] {
  if (!origin) return [];
  const date = (s?: string | null) => {
    const d = s ? new Date(s) : null;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  };
  return [
    { url: `${origin}/` },
    { url: `${origin}/events` },
    ...clubs.map((c) => ({ url: `${origin}/clubs/${encodeURIComponent(c.slug)}` })),
    ...events
      .filter((e) => eventInSitemapWindow(e.starts_at, now))
      .map((e) => ({ url: `${origin}/events/${e.id}`, lastModified: date(e.created_at) })),
  ];
}

/** schema.org Event for search engines. Pure; JSON-escape with `jsonLdString` before embedding in a script tag. */
export function eventJsonLd(
  event: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
    description: string | null;
    status: string;
  },
  club: { slug: string; name: string },
  origin: string | null,
): Record<string, unknown> {
  const iso = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const desc = event.description?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: iso(event.starts_at),
    ...(event.ends_at && iso(event.ends_at) ? { endDate: iso(event.ends_at) } : {}),
    eventStatus: event.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(event.venue ? { location: { "@type": "Place", name: event.venue } } : {}),
    ...(desc ? { description: desc.length > 300 ? `${desc.slice(0, 299)}…` : desc } : {}),
    organizer: {
      "@type": "Organization",
      name: club.name,
      ...(origin ? { url: `${origin}/clubs/${encodeURIComponent(club.slug)}` } : {}),
    },
    ...(origin ? { url: `${origin}/events/${event.id}` } : {}),
  };
}

/** JSON.stringify that cannot break out of a <script> tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
