import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/EventCard";
import { Empty, PageHeader } from "@/components/ui";
import { EVENT_CATEGORIES, pickFilter } from "@/lib/categories";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: clubRows } = await supabase.from("clubs").select("id, slug, name").eq("is_active", true).order("name");
  const clubs = (clubRows ?? []) as { id: string; slug: string; name: string }[];
  const category = pickFilter(sp.category, EVENT_CATEGORIES);
  const clubSlug = pickFilter(sp.club, clubs.map((c) => c.slug));
  const clubId = clubs.find((c) => c.slug === clubSlug)?.id;

  const select = "id, title, category, venue, starts_at, ends_at, clubs(name, slug, accent_color)";
  const base = () => {
    let q = supabase.from("events").select(select).eq("status", "published");
    if (category) q = q.eq("category", category);
    if (clubId) q = q.eq("club_id", clubId);
    return q;
  };
  const [{ data: up }, { data: liveRows }, { data: past }] = await Promise.all([
    base().gte("starts_at", now).order("starts_at").limit(60),
    base().lt("starts_at", now).gt("ends_at", now).order("starts_at"),
    base().lt("starts_at", now).order("starts_at", { ascending: false }).limit(30),
  ]);
  const live = (liveRows ?? []) as unknown as EventCardData[];
  const liveIds = new Set(live.map((e) => e.id));
  const upcoming = [...live, ...((up ?? []) as unknown as EventCardData[])];
  const earlier = ((past ?? []) as unknown as EventCardData[]).filter((e) => !liveIds.has(e.id)).slice(0, 24);

  const href = (c: string, k: string) => {
    const p = new URLSearchParams();
    if (c) p.set("category", c);
    if (k) p.set("club", k);
    const s = p.toString();
    return s ? `/events?${s}` : "/events";
  };
  const chip = (active: boolean) => `badge ${active ? "bg-brand text-brand-fg border-transparent" : "hover:bg-black/5 dark:hover:bg-white/10"}`;

  return (
    <>
      <PageHeader title="Events" subtitle="Everything happening across all clubs." />
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap gap-2" aria-label="Filter by category">
          <Link href={href("", clubSlug)} className={chip(!category)}>All categories</Link>
          {EVENT_CATEGORIES.map((c) => <Link key={c} href={href(c, clubSlug)} className={chip(category === c)}>{c}</Link>)}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by club">
          <Link href={href(category, "")} className={chip(!clubSlug)}>All clubs</Link>
          {clubs.map((c) => <Link key={c.id} href={href(category, c.slug)} className={chip(clubSlug === c.slug)}>{c.name}</Link>)}
        </div>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <Empty>No upcoming events{category || clubSlug ? " match these filters" : ""}.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} e={e} live={liveIds.has(e.id)} />)}</div>
      )}
      <h2 className="mb-3 mt-10 text-lg font-semibold">Recent</h2>
      {earlier.length === 0 ? (
        <Empty>No past events{category || clubSlug ? " match these filters" : " yet"}.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{earlier.map((e) => <EventCard key={e.id} e={e} />)}</div>
      )}
    </>
  );
}
