import { safeColor } from "@/lib/safe";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/EventCard";
import { ClubLogo, Empty, TintBadge, toneFor } from "@/components/ui";
import type { Club } from "@/lib/types";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const select = "id, title, category, venue, starts_at, clubs(name, slug, accent_color)";
  const [{ data: clubsData }, { data: eventsData }, { data: runningData }] = await Promise.all([
    supabase.from("clubs").select("*").eq("is_active", true).order("name"),
    supabase
      .from("events")
      .select(select)
      .eq("status", "published")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(6),
    supabase.from("events").select(select).eq("status", "published").lt("starts_at", nowIso).gt("ends_at", nowIso).order("starts_at").limit(6),
  ]);

  const allClubs = (clubsData as Club[]) ?? [];
  const categories = [...new Set(allClubs.map((c) => c.category))].sort();
  const clubs = allClubs.filter(
    (c) => (!cat || c.category === cat) && (!q || `${c.name} ${c.tagline ?? ""} ${c.description ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const live = ((runningData ?? []) as unknown as EventCardData[]).slice(0, 6);
  const events = ((eventsData ?? []) as unknown as EventCardData[]).slice(0, 6 - live.length);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-orange-500 px-6 py-12 text-white shadow-lg shadow-fuchsia-500/20 sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-yellow-300/25 blur-3xl" />
        <h1 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Find your club. Join the fun.</h1>
        <p className="relative mt-2 max-w-xl text-white/90">
          {allClubs.length} co-curricular clubs, one place — browse clubs, register for events and share feedback.
        </p>
        <form className="relative mt-5 flex max-w-lg gap-2" action="/">
          <input name="q" defaultValue={q} placeholder="Search clubs…" className="input !border-transparent !text-slate-900 !bg-white" aria-label="Search clubs" />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <button className="btn !bg-white !text-fuchsia-700 !border-transparent hover:!bg-yellow-100" type="submit">Search</button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="border-l-4 border-fuchsia-500 pl-3 text-xl font-bold">Upcoming events</h2>
          <Link href="/events" className="text-sm text-brand hover:underline">All events →</Link>
        </div>
        {events.length + live.length === 0 ? (
          <Empty>No upcoming events right now. Check back soon!</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((e) => <EventCard key={e.id} e={e} live />)}
            {events.map((e) => <EventCard key={e.id} e={e} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 border-l-4 border-indigo-500 pl-3 text-xl font-bold">Clubs</h2>
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className={`badge px-3 py-1 ${!cat ? "border-transparent bg-brand text-brand-fg" : "hover:bg-brand/10"}`}>All</Link>
          {categories.map((c) => (
            <Link key={c} href={`/?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`badge px-3 py-1 ${cat === c ? "border-transparent text-white" : "tone hover:brightness-95"}`} style={{ "--tone": toneFor(c), ...(cat === c ? { background: toneFor(c) } : {}) } as React.CSSProperties}>
              {c}
            </Link>
          ))}
        </div>
        {clubs.length === 0 ? (
          <Empty>No clubs match your search.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => (
              <Link key={c.id} href={`/clubs/${c.slug}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderTop: `3px solid ${safeColor(c.accent_color)}`, background: `linear-gradient(180deg, color-mix(in srgb, ${safeColor(c.accent_color)} 9%, var(--surface)), var(--surface) 60%)` }}>
                <div className="flex items-start justify-between gap-3">
                  <TintBadge>{c.category}</TintBadge>
                  <ClubLogo club={c} size={44} />
                </div>
                <h3 className="mt-2 font-semibold">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{c.tagline ?? c.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
