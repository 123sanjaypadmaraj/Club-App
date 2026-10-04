import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/EventForm";
import { ParticipantsTable } from "@/components/ParticipantsTable";
import { ConfirmButton, SubmitButton } from "@/components/SubmitButton";
import { HBars, MiniBars, Stars } from "@/components/charts";
import { Empty, Field, Notice, Stat } from "@/components/ui";
import { fmtDateTime, pct } from "@/lib/format";
import { computeInsights } from "@/lib/insights";
import { addParticipantAction, deleteEventAction, duplicateEventAction, importParticipantsAction, saveEventAction } from "@/app/dashboard/actions";
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
  const all = (regs as Registration[]) ?? [];
  const confirmed = all.filter((r) => r.status === "confirmed");
  const waitlisted = all.length - confirmed.length;
  const feedback = (fb as Feedback[]) ?? [];
  const ins = computeInsights(confirmed);
  const avg = feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : null;
  const publicUrl = `/events/${event.id}`;
  const base = `/dashboard/clubs/${slug}/events/${event.id}`;
  const filled = event.capacity ? Math.min(100, Math.round((confirmed.length / event.capacity) * 100)) : null;

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

      <section id="edit" className="scroll-mt-4">
        <h2 className="mb-3 text-lg font-semibold">Event details</h2>
        <EventForm action={saveEventAction.bind(null, slug, event.id)} event={event} />
      </section>

      <div className="card flex flex-wrap items-center gap-4 border-brand/40 bg-brand/5">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">Event day</h2>
          <p className="text-sm text-muted">Open the live check-in on a phone or laptop at the entrance — search, scan QR tickets, add walk-ins. Several volunteers can use it at once.</p>
        </div>
        <Link href={`${base}/checkin`} className="btn btn-primary !px-5 !py-3 !text-base">Open check-in →</Link>
        <div className="flex gap-2 text-sm">
          <Link href={`${base}/print?mode=sheet`} className="btn">Attendance sheet</Link>
          <Link href={`${base}/print?mode=badges`} className="btn">Name badges</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Registered" value={confirmed.length} hint={event.capacity ? `of ${event.capacity} seats (${filled}%)` : "no cap"} />
        <Stat label="Waitlist" value={waitlisted} hint={waitlisted ? "auto-promoted on cancellations" : "none"} />
        <Stat label="Checked in" value={ins.checkedIn} hint={`${ins.notArrived} yet to arrive`} />
        <Stat label="Attendance" value={pct(ins.rate)} />
        <Stat label="Rating" value={avg?.toFixed(2) ?? "—"} hint={`${feedback.length} responses`} />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Participants ({all.length})</h2>
          <a href={`/dashboard/export/participants?event=${event.id}`} className="btn">Download all as CSV</a>
        </div>

        <div className="mb-3 grid gap-3 lg:grid-cols-2">
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">+ Add one participant</summary>
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
          <details className="card">
            <summary className="cursor-pointer text-sm font-medium">⬆ Import registrations (CSV / Google Forms)</summary>
            <form action={importParticipantsAction.bind(null, slug, event.id)} className="mt-3 space-y-3">
              <p className="text-xs text-muted">
                Export your Google Form responses as CSV and upload it. Columns are matched by header (Name, Email, Roll no, Department/Branch, Year, Phone);
                without a header the order is name, email, roll no, department, year, phone. People already registered are skipped. Everyone gets a QR ticket code.
              </p>
              <input type="file" name="file" accept=".csv,text/csv" className="input" />
              <textarea name="csv" rows={3} placeholder="…or paste CSV rows here" className="input font-mono" />
              <SubmitButton className="btn btn-primary" pendingText="Importing…">Import</SubmitButton>
            </form>
          </details>
        </div>

        {all.length === 0 ? (
          <Empty>No registrations yet. Share <code className="rounded bg-black/5 px-1 dark:bg-white/10">{publicUrl}</code> or import a CSV above.</Empty>
        ) : (
          <ParticipantsTable slug={slug} eventId={event.id} eventTitle={event.title} rows={all} />
        )}
      </section>

      {confirmed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Insights</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {event.capacity && (
              <div className="card lg:col-span-2">
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="font-medium">Seats filled</span>
                  <span className="tabular-nums text-muted">{confirmed.length} / {event.capacity}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full bg-brand" style={{ width: `${filled}%` }} />
                </div>
              </div>
            )}
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">Registrations per day</h3>
              <MiniBars rows={ins.registrationTimeline} label="Registrations per day" />
            </div>
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">Arrivals (15-minute slots)</h3>
              {ins.checkinTimeline.length ? <MiniBars rows={ins.checkinTimeline} label="Check-ins per 15 minutes" /> : <p className="text-sm text-muted">No check-ins yet.</p>}
            </div>
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">By department</h3>
              <HBars rows={ins.byDepartment.slice(0, 8)} />
            </div>
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">By year</h3>
              <HBars rows={ins.byYear} />
            </div>
          </div>
        </section>
      )}

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
