import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { ExtLink, Field, Notice, TintBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { eventShareDescription } from "@/lib/events";
import { registerForEvent } from "@/app/actions";
import type { Club, ClubEvent } from "@/lib/types";

const UUID = /^[0-9a-f-]{36}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*, clubs(*)").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: c } = await supabase.from("event_public_counts").select("registrations, waitlisted").eq("event_id", id).maybeSingle();
  return {
    event: data as ClubEvent & { clubs: Club },
    registered: (c?.registrations as number | undefined) ?? 0,
    waitlisted: (c?.waitlisted as number | undefined) ?? 0,
  };
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "Event" };
  const { title, starts_at, venue, description } = r.event;
  const text = eventShareDescription(fmtDateTime(starts_at), venue, description);
  return { title, description: text, openGraph: { title, description: text, type: "website" } };
}

export default async function EventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await load(id);
  if (!r) notFound();
  const { event, registered, waitlisted } = r;
  const club = event.clubs;

  const started = new Date(event.starts_at) <= new Date();
  const over = new Date(event.ends_at ?? event.starts_at) <= new Date();
  const full = event.capacity != null && registered >= event.capacity;
  const cancelled = event.status === "cancelled";
  const canRegister = event.status === "published" && event.registration_open && !over; // a full event waitlists
  const register = registerForEvent.bind(null, event.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />

      <header className="card" style={{ borderTop: `4px solid ${club.accent_color}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <TintBadge>{event.category}</TintBadge>
          {cancelled && <span className="badge border-red-500/40 text-red-600">Cancelled</span>}
          {event.status === "draft" && <span className="badge">Draft (only you can see this)</span>}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{event.title}</h1>
        <p className="mt-1 text-sm text-muted">
          by <Link href={`/clubs/${club.slug}`} className="text-brand hover:underline">{club.name}</Link>
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted">When: </dt><dd className="inline">{fmtDateTime(event.starts_at)}{event.ends_at ? ` – ${fmtDateTime(event.ends_at)}` : ""}</dd></div>
          {event.venue && <div><dt className="inline text-muted">Where: </dt><dd className="inline">{event.venue}</dd></div>}
          <div>
            <dt className="inline text-muted">Registered: </dt>
            <dd className="inline">{registered}{event.capacity ? ` / ${event.capacity}` : ""}{full ? " (full)" : ""}{waitlisted ? ` · ${waitlisted} on waitlist` : ""}</dd>
          </div>
        </dl>
        {event.status === "published" && (
          <p className="mt-3"><a href={`/events/${event.id}/calendar`} className="btn">Add to calendar</a></p>
        )}
        {event.description && <p className="mt-4 whitespace-pre-line">{event.description}</p>}
      </header>

      {!cancelled && !over && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">{full ? "Join the waitlist" : "Register"}</h2>
          {full && (
            <p className="text-sm text-muted">All seats are taken. Join the waitlist — if someone cancels you move up automatically and your ticket turns confirmed.</p>
          )}
          {event.registration_url && event.registration_open && <div><ExtLink href={event.registration_url}>Open registration form</ExtLink></div>}
          {!canRegister ? (
            <p className="text-sm text-muted">Registration is closed.</p>
          ) : (
            <details open={!event.registration_url} className="group">
              {event.registration_url && <summary className="cursor-pointer text-sm text-brand">Or register directly here</summary>}
              <form action={register} className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Full name *"><input name="full_name" required maxLength={120} className="input" autoComplete="name" /></Field>
                <Field label="College email *"><input name="email" type="email" required maxLength={160} className="input" autoComplete="email" /></Field>
                <Field label="Roll number"><input name="roll_no" maxLength={40} className="input" /></Field>
                <Field label="Department"><input name="department" maxLength={60} className="input" /></Field>
                <Field label="Year">
                  <select name="year" className="input" defaultValue="">
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="Phone"><input name="phone" type="tel" maxLength={20} className="input" autoComplete="tel" /></Field>
                <div className="sm:col-span-2"><SubmitButton pendingText={full ? "Joining…" : "Registering…"}>{full ? "Join waitlist" : "Register"}</SubmitButton></div>
              </form>
            </details>
          )}
        </section>
      )}

      {!cancelled && started && event.status === "published" && (
        <section className="card flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h2 className="text-lg font-semibold">Been to this event?</h2>
            <p className="text-sm text-muted">Tell the club how it went.</p>
          </div>
          {event.feedback_url && <ExtLink href={event.feedback_url}>Feedback form</ExtLink>}
          <Link href={`/events/${event.id}/feedback`} className="btn btn-primary">Quick feedback</Link>
        </section>
      )}
    </div>
  );
}
