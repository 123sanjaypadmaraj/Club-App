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
