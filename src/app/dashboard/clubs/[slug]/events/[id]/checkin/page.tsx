import { LEAD_EVENT_COLUMNS } from "@/lib/eventColumns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckinConsole } from "@/components/CheckinConsole";
import { fmtDateTime } from "@/lib/format";
import type { ClubEvent, Registration } from "@/lib/types";

export const metadata = { title: "Check-in" };

export default async function CheckinPage({ params }: PageProps<"/dashboard/clubs/[slug]/events/[id]/checkin">) {
  const { slug, id } = await params;
  const { club } = await requireClubAccess(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select(LEAD_EVENT_COLUMNS).eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!ev) notFound();
  const event = ev as ClubEvent;
  const { data: regs } = await supabase.from("event_registrations").select("*").eq("event_id", id).order("registered_at");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Check-in · {event.title}</h1>
          <p className="text-sm text-muted">{fmtDateTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href={`/dashboard/clubs/${slug}/events/${id}/print?mode=sheet`} className="btn" target="_blank">Backup sheet</Link>
          <Link href={`/dashboard/clubs/${slug}/events/${id}`} className="btn">← Manage event</Link>
        </div>
      </div>
      <CheckinConsole slug={slug} eventId={id} initial={(regs as Registration[]) ?? []} capacity={event.capacity} />
    </div>
  );
}
