import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/EventCard";
import { Empty } from "@/components/ui";
import type { Club } from "@/lib/types";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";

  const supabase = await createClient();
  const [{ data: clubsData }, { data: eventsData }] = await Promise.all([
    supabase.from("clubs").select("*").eq("is_active", true).order("name"),
    supabase
      .from("events")
      .select("id, title, category, venue, starts_at, clubs(name, slug, accent_color)")
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(6),
  ]);

  const allClubs = (clubsData as Club[]) ?? [];
  const categories = [...new Set(allClubs.map((c) => c.category))].sort();
  const clubs = allClubs.filter(
    (c) => (!cat || c.category === cat) && (!q || `${c.name} ${c.tagline ?? ""} ${c.description ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const events = (eventsData ?? []) as unknown as EventCardData[];

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your club. Join the fun.</h1>
        <p className="mt-2 max-w-xl text-indigo-100">
          {allClubs.length} co-curricular clubs, one place — browse clubs, register for events and share feedback.
        </p>
        <form className="mt-5 flex max-w-lg gap-2" action="/">
          <input name="q" defaultValue={q} placeholder="Search clubs…" className="input !border-transparent !text-slate-900 !bg-white" aria-label="Search clubs" />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <button className="btn !bg-white !text-indigo-700 !border-transparent" type="submit">Search</button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold">Upcoming events</h2>
          <Link href="/events" className="text-sm text-brand hover:underline">All events →</Link>
        </div>
        {events.length === 0 ? (
          <Empty>No upcoming events right now. Check back soon!</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <EventCard key={e.id} e={e} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Clubs</h2>
        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className={`badge px-3 py-1 ${!cat ? "bg-brand text-brand-fg" : ""}`}>All</Link>
          {categories.map((c) => (
            <Link key={c} href={`/?cat=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`badge px-3 py-1 ${cat === c ? "bg-brand text-brand-fg" : ""}`}>
              {c}
            </Link>
          ))}
        </div>
        {clubs.length === 0 ? (
          <Empty>No clubs match your search.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c) => (
              <Link key={c.id} href={`/clubs/${c.slug}`} className="card block transition hover:shadow-md" style={{ borderTop: `3px solid ${c.accent_color}` }}>
                <span className="badge">{c.category}</span>
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
