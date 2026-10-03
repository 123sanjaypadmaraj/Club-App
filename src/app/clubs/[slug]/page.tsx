import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventCardData } from "@/components/EventCard";
import { ClubLogo, Empty, ExtLink, TintBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { Announcement, Club } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("name, tagline, description").eq("slug", slug).maybeSingle();
  const title = data?.name ?? "Club";
  const description = data?.tagline ?? data?.description ?? undefined;
  return { title, description, openGraph: { title, description, type: "website" } };
}

export default async function ClubPage({ params }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const club = data as Club;

  const select = "id, title, category, venue, starts_at, clubs(name, slug, accent_color)";
  const now = new Date().toISOString();
  const [{ data: up }, { data: past }, { data: ann }, { data: running }] = await Promise.all([
    supabase.from("events").select(select).eq("club_id", club.id).eq("status", "published").gte("starts_at", now).order("starts_at"),
    supabase.from("events").select(select).eq("club_id", club.id).eq("status", "published").lt("starts_at", now).order("starts_at", { ascending: false }).limit(12),
    supabase.from("announcements").select("*").eq("club_id", club.id).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("events").select(select).eq("club_id", club.id).eq("status", "published").lt("starts_at", now).gt("ends_at", now).order("starts_at"),
  ]);
  const live = (running ?? []) as unknown as EventCardData[];
  const liveIds = new Set(live.map((e) => e.id));
  const upcoming = (up ?? []) as unknown as EventCardData[];
  const earlier = ((past ?? []) as unknown as EventCardData[]).filter((e) => !liveIds.has(e.id));
  const announcements = (ann as Announcement[]) ?? [];

  return (
    <div className="space-y-10">
      <header className="card" style={{ borderTop: `4px solid ${club.accent_color}`, background: `linear-gradient(135deg, color-mix(in srgb, ${club.accent_color} 14%, var(--surface)), var(--surface) 65%)` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <TintBadge>{club.category}</TintBadge>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{club.name}</h1>
            {club.tagline && <p className="mt-1 text-lg text-muted">{club.tagline}</p>}
          </div>
          <ClubLogo club={club} size={84} />
        </div>
        {club.description && <p className="mt-4 max-w-3xl">{club.description}</p>}
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {club.meeting_schedule && <div><dt className="inline text-muted">Meets: </dt><dd className="inline">{club.meeting_schedule}</dd></div>}
          {club.faculty_advisor && <div><dt className="inline text-muted">Faculty advisor: </dt><dd className="inline">{club.faculty_advisor}</dd></div>}
          {club.founded_year && <div><dt className="inline text-muted">Founded: </dt><dd className="inline">{club.founded_year}</dd></div>}
          {club.contact_email && <div><dt className="inline text-muted">Contact: </dt><dd className="inline"><a className="text-brand hover:underline" href={`mailto:${club.contact_email}`}>{club.contact_email}</a></dd></div>}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {club.join_form_url && <a href={club.join_form_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Join this club ↗</a>}
          {club.instagram_url && <ExtLink href={club.instagram_url}>Instagram</ExtLink>}
          {club.linkedin_url && <ExtLink href={club.linkedin_url}>LinkedIn</ExtLink>}
          {club.whatsapp_url && <ExtLink href={club.whatsapp_url}>WhatsApp</ExtLink>}
          {club.website_url && <ExtLink href={club.website_url}>Website</ExtLink>}
        </div>
      </header>

      {announcements.length > 0 && (
        <section>
          <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-lg font-semibold">Announcements</h2>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="card border-l-4 border-l-orange-400">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{a.pinned && "📌 "}{a.title}</h3>
                  <time className="text-xs text-muted">{fmtDate(a.created_at)}</time>
                </div>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 border-l-4 border-fuchsia-500 pl-3 text-lg font-semibold">Upcoming events</h2>
        {upcoming.length + live.length === 0 ? <Empty>No upcoming events.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((e) => <EventCard key={e.id} e={e} showClub={false} live />)}
            {upcoming.map((e) => <EventCard key={e.id} e={e} showClub={false} />)}
          </div>
        )}
        <p className="mt-3 text-sm"><a href={`/clubs/${club.slug}/calendar`} className="text-brand hover:underline">Subscribe to calendar</a></p>
      </section>

      {earlier.length > 0 && (
        <section>
          <h2 className="mb-3 border-l-4 border-slate-400 pl-3 text-lg font-semibold">Past events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{earlier.map((e) => <EventCard key={e.id} e={e} showClub={false} />)}</div>
        </section>
      )}
    </div>
  );
}
