import Link from "next/link";
import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEventStats } from "@/lib/data";
import { RANGES, inRange, monthly, parseRange, totals, trend } from "@/lib/stats";
import { fmtDate, fmtMoney, fmtNum, pct } from "@/lib/format";
import { Stars, TrendChart } from "@/components/charts";
import { Empty, RangeFilter, Stat } from "@/components/ui";

type Comment = { id: string; rating: number; comment: string | null; created_at: string; events: { title: string } | null };

export default async function ClubOverview({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  const range = parseRange(sp.range);

  const supabase = await createClient();
  const [all, { count: memberCount }, { data: fb }] = await Promise.all([
    getEventStats(club.id),
    supabase.from("club_members").select("id", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "active"),
    supabase
      .from("event_feedback")
      .select("id, rating, comment, created_at, events!inner(title, club_id)")
      .eq("events.club_id", club.id)
      .not("comment", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const stats = inRange(all, range);
  const t = totals(stats);
  const points = monthly(stats, range);
  const top = [...stats].sort((a, b) => b.registrations - a.registrations).slice(0, 5);
  const comments = ((fb ?? []) as unknown as Comment[]).filter((c) => c.comment);

  return (
    <>
      <div className="mb-4 flex justify-end"><RangeFilter base={`/dashboard/clubs/${slug}`} current={range} options={RANGES} /></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Events" value={fmtNum(t.events)} delta={trend(points, "events")} hint="vs earlier half" />
        <Stat label="Registrations" value={fmtNum(t.registrations)} delta={trend(points, "registrations")} hint="vs earlier half" />
        <Stat label="Attendance rate" value={pct(t.attendanceRate)} hint={`${fmtNum(t.attendees)} attended`} />
        <Stat label="Avg. rating" value={t.avgRating?.toFixed(2) ?? "—"} hint={`${t.feedbackCount} responses`} />
        <Stat label="Active members" value={fmtNum(memberCount ?? 0)} />
        <Stat label="Avg. turnout / event" value={t.events ? fmtNum(Math.round(t.registrations / t.events)) : "—"} />
        <Stat label="Budget spent" value={fmtMoney(t.budgetSpent)} hint={`of ${fmtMoney(t.budgetAllocated)}`} />
        <Stat label="Past events" value={t.pastEvents} hint={`${t.events - t.pastEvents} upcoming`} />
      </div>

      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Registrations & attendance over time</h2>
        <TrendChart points={points} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Top events by registrations</h2>
          {top.length === 0 ? <Empty>No events in this period.</Empty> : (
            <ul className="divide-y divide-line">
              {top.map((e) => (
                <li key={e.event_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/dashboard/clubs/${slug}/events/${e.event_id}`} className="truncate hover:text-brand hover:underline">{e.title}</Link>
                  <span className="shrink-0 tabular-nums text-muted">{e.registrations} regs · <Stars value={e.avg_rating == null ? null : Number(e.avg_rating)} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Recent feedback</h2>
            <a href={`/dashboard/export/feedback?club=${slug}`} className="text-xs text-brand hover:underline">Download all feedback (CSV)</a>
          </div>
          {comments.length === 0 ? <Empty>No written feedback yet.</Empty> : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted"><span className="truncate">{c.events?.title}</span><span>{fmtDate(c.created_at)}</span></div>
                  <div><Stars value={c.rating} /> <span className="ml-1">{c.comment}</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
