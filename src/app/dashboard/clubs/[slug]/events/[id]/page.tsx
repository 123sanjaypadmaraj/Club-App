import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/EventForm";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { Stars } from "@/components/charts";
import { Empty, Field, Notice, Stat } from "@/components/ui";
import { fmtDate, fmtDateTime, pct } from "@/lib/format";
import { filterRegistrations } from "@/lib/participants";
import {
  addParticipantAction, deleteEventAction, duplicateEventAction, removeParticipantAction, saveEventAction, toggleAttendanceAction,
} from "@/app/dashboard/actions";
import type { ClubEvent, Feedback, Registration } from "@/lib/types";

export const metadata = { title: "Manage event" };

export default async function EventAdminPage({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/events/[id]">) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("*").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!ev) notFound();
  const event = ev as ClubEvent;

  const [{ data: regs }, { data: fb }] = await Promise.all([
    supabase.from("event_registrations").select("*").eq("event_id", id).order("registered_at", { ascending: false }),
    supabase.from("event_feedback").select("*").eq("event_id", id).order("created_at", { ascending: false }),
  ]);
  const registrations = (regs as Registration[]) ?? [];
  const feedback = (fb as Feedback[]) ?? [];
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const shown = filterRegistrations(registrations, q);
  const attended = registrations.filter((r) => r.attended).length;
  const avg = feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : null;
  const publicUrl = `/events/${event.id}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dashboard/clubs/${slug}/events`} className="text-sm text-brand hover:underline">← All events</Link>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={publicUrl} className="btn">Public page ↗</Link>
          <Link href={`${publicUrl}/feedback`} className="btn">Feedback page ↗</Link>
          <form action={duplicateEventAction.bind(null, slug, event.id)}>
            <SubmitButton className="btn" pendingText="Duplicating…">Duplicate</SubmitButton>
          </form>
        </div>
      </div>
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registered" value={registrations.length} hint={event.capacity ? `of ${event.capacity} seats` : "no cap"} />
        <Stat label="Attended" value={attended} />
        <Stat label="Attendance" value={pct(registrations.length ? Math.round((attended / registrations.length) * 100) : null)} />
        <Stat label="Rating" value={avg?.toFixed(2) ?? "—"} hint={`${feedback.length} responses`} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Event details</h2>
        <EventForm action={saveEventAction.bind(null, slug, event.id)} event={event} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Participants ({registrations.length})</h2>
          <a href={`/dashboard/export/participants?event=${event.id}`} className="btn">Download CSV</a>
        </div>

        <details className="card mb-3">
          <summary className="cursor-pointer text-sm font-medium">+ Add a walk-in participant</summary>
          <form action={addParticipantAction.bind(null, slug, event.id)} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Name *"><input name="full_name" required className="input" /></Field>
            <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
            <Field label="Roll no"><input name="roll_no" className="input" /></Field>
            <Field label="Department"><input name="department" className="input" /></Field>
            <Field label="Year"><input name="year" type="number" min={1} max={6} className="input" /></Field>
            <Field label="Phone"><input name="phone" className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="attended" /> Mark as attended</label>
            <div className="sm:col-span-3"><SubmitButton className="btn btn-primary" pendingText="Adding…">Add participant</SubmitButton></div>
          </form>
        </details>

        {registrations.length > 0 && (
          <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
            <input name="q" defaultValue={q} placeholder="Search name, email or roll no" className="input max-w-xs" aria-label="Search participants" />
            <button type="submit" className="btn">Search</button>
            {q && (
              <>
                <Link href={`/dashboard/clubs/${slug}/events/${event.id}`} className="text-sm text-brand hover:underline">Clear</Link>
                <span className="text-sm text-muted">Showing {shown.length} of {registrations.length}</span>
              </>
            )}
          </form>
        )}

        {registrations.length === 0 ? (
          <Empty>No registrations yet.</Empty>
        ) : shown.length === 0 ? (
          <Empty>No participants match “{q}”.</Empty>
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Name</th><th className="th">Email</th><th className="th">Roll no</th><th className="th">Dept</th>
                  <th className="th">Yr</th><th className="th">Phone</th><th className="th">Registered</th><th className="th">Attended</th><th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="td font-medium">{r.full_name}</td>
                    <td className="td text-muted">{r.email}</td>
                    <td className="td">{r.roll_no}</td>
                    <td className="td">{r.department}</td>
                    <td className="td">{r.year}</td>
                    <td className="td">{r.phone}</td>
                    <td className="td text-muted">{fmtDate(r.registered_at)}</td>
                    <td className="td">
                      <form action={toggleAttendanceAction.bind(null, slug, event.id, r.id, !r.attended)}>
                        <SubmitButton className={`btn !py-1 ${r.attended ? "btn-primary" : ""}`} pendingText="…">{r.attended ? "✓ Present" : "Check in"}</SubmitButton>
                      </form>
                    </td>
                    <td className="td text-right">
                      <form action={removeParticipantAction.bind(null, slug, event.id, r.id)}>
                        <ConfirmButton message={`Remove ${r.full_name} from this event?`} className="text-sm text-red-600 hover:underline">Remove</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Feedback ({feedback.length})</h2>
        {feedback.length === 0 ? (
          <Empty>No feedback yet. Share <code className="rounded bg-black/5 px-1 dark:bg-white/10">{publicUrl}/feedback</code> after the event.</Empty>
        ) : (
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li key={f.id} className="card !py-3 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span><Stars value={f.rating} /> · {f.full_name ?? f.email}</span><span>{fmtDateTime(f.created_at)}</span>
                </div>
                {f.comment && <p className="mt-1 whitespace-pre-line">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card border-red-500/30">
        <h2 className="font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
        <p className="my-2 text-sm text-muted">Deleting an event also deletes its registrations and feedback. Consider setting it to “Cancelled” instead.</p>
        <form action={deleteEventAction.bind(null, slug, event.id)}>
          <ConfirmButton message="Delete this event and all its participant data? This cannot be undone.">Delete event</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
