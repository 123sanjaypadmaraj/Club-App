import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile, getManagedClubs } from "@/lib/auth";
import { getClubSummaries, getEventStats } from "@/lib/data";
import { RANGES, groupBy, inRange, monthly, parseRange, totals, trend, type MonthPoint } from "@/lib/stats";
import { fmtMoney, fmtNum, pct } from "@/lib/format";
import { HBars, Stars, TrendChart } from "@/components/charts";
import { Empty, PageHeader, RangeFilter, Stat } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const SORTS = {
  registrations: "Registrations",
  events: "Events",
  attendance: "Attendance %",
  rating: "Rating",
  members: "Members",
} as const;
type Sort = keyof typeof SORTS;

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") return <LeadHome />;

  const sp = await searchParams;
  const range = parseRange(sp.range);
  const sort: Sort = typeof sp.sort === "string" && sp.sort in SORTS ? (sp.sort as Sort) : "registrations";

  const [allStats, summaries] = await Promise.all([getEventStats(), getClubSummaries()]);
  const stats = inRange(allStats, range);
  const t = totals(stats);
  const points = monthly(stats, range);
  const byClub = groupBy(stats, (s) => s.club_id);

  const rows = summaries
    .filter((c) => c.is_active)
    .map((c) => {
      const ct = totals(byClub.get(c.club_id) ?? []);
      return { ...c, ...ct, points: monthly(byClub.get(c.club_id) ?? [], range) };
    });
  const value = (r: (typeof rows)[number]) =>
    sort === "registrations" ? r.registrations : sort === "events" ? r.events : sort === "attendance" ? (r.attendanceRate ?? -1) : sort === "rating" ? (r.avgRating ?? -1) : r.active_members;
  rows.sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));

  const members = summaries.reduce((a, c) => a + (c.is_active ? c.active_members : 0), 0);
  const quiet = rows.filter((r) => r.events === 0);
  const byCategory = [...groupBy(rows, (r) => r.category)].map(([label, rs]) => ({ label, value: rs.reduce((a, r) => a + r.registrations, 0) })).sort((a, b) => b.value - a.value);

  // Heatmap: registrations per club per month (last 12 months shown)
  const hm: MonthPoint[] = points.slice(-12);
  const hmMax = Math.max(1, ...rows.flatMap((r) => r.points.filter((p) => hm.some((h) => h.key === p.key)).map((p) => p.registrations)));

  return (
    <>
      <PageHeader
        title="Club performance"
        subtitle={`${rows.length} active clubs`}
        actions={
          <>
            <RangeFilter base="/dashboard" current={range} options={RANGES} />
            <a className="btn" href={`/dashboard/export/clubs?range=${range}`}>Export CSV</a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Events held" value={fmtNum(t.events)} delta={trend(points, "events")} hint="vs earlier half" />
        <Stat label="Registrations" value={fmtNum(t.registrations)} delta={trend(points, "registrations")} hint="vs earlier half" />
        <Stat label="Attendance rate" value={pct(t.attendanceRate)} hint={`${fmtNum(t.attendees)} attended`} />
        <Stat label="Avg. rating" value={t.avgRating?.toFixed(2) ?? "—"} hint={`${fmtNum(t.feedbackCount)} responses`} />
        <Stat label="Active members" value={fmtNum(members)} hint="across all clubs" />
        <Stat label="Clubs with events" value={`${rows.length - quiet.length} / ${rows.length}`} hint="in this period" />
        <Stat label="Budget spent" value={fmtMoney(t.budgetSpent)} hint={`of ${fmtMoney(t.budgetAllocated)} allocated`} />
        <Stat label="Avg. turnout / event" value={t.events ? fmtNum(Math.round(t.registrations / t.events)) : "—"} hint="registrations" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Registrations & attendance over time</h2>
          <TrendChart points={points} />
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Registrations by category</h2>
          {byCategory.length ? <HBars rows={byCategory} format={fmtNum} /> : <Empty>No data yet.</Empty>}
        </section>
      </div>

      <section className="mt-6 card overflow-x-auto !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h2 className="font-semibold">Club leaderboard</h2>
          <div className="flex flex-wrap gap-1 text-xs">
            {(Object.keys(SORTS) as Sort[]).map((k) => (
              <Link key={k} href={`/dashboard?range=${range}&sort=${k}`} className={`badge px-2.5 py-1 ${sort === k ? "bg-brand text-brand-fg" : ""}`}>{SORTS[k]}</Link>
            ))}
          </div>
        </div>
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-y border-line">
              <th className="th w-10">#</th><th className="th">Club</th><th className="th">Category</th>
              <th className="th text-right">Events</th><th className="th text-right">Registrations</th>
              <th className="th text-right">Attendance</th><th className="th">Rating</th><th className="th text-right">Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.club_id} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                <td className="td text-muted">{i + 1}</td>
                <td className="td font-medium"><Link className="hover:text-brand hover:underline" href={`/dashboard/clubs/${r.slug}`}>{r.name}</Link></td>
                <td className="td text-muted">{r.category}</td>
                <td className="td text-right tabular-nums">{r.events}</td>
                <td className="td text-right tabular-nums">{fmtNum(r.registrations)}</td>
                <td className="td text-right tabular-nums">{pct(r.attendanceRate)}</td>
                <td className="td"><Stars value={r.avgRating} /></td>
                <td className="td text-right tabular-nums">{r.active_members}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 card overflow-x-auto">
        <h2 className="mb-1 font-semibold">Registrations per club, month by month</h2>
        <p className="mb-3 text-xs text-muted">Darker = more registrations. Blank cells mean no events that month.</p>
        <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr><th className="th">Club</th>{hm.map((h) => <th key={h.key} className="th text-center !px-1">{h.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = new Map(r.points.map((p) => [p.key, p]));
              return (
                <tr key={r.club_id}>
                  <td className="whitespace-nowrap py-1 pr-3 text-sm"><Link className="hover:underline" href={`/dashboard/clubs/${r.slug}`}>{r.name}</Link></td>
                  {hm.map((h) => {
                    const p = m.get(h.key);
                    const v = p?.registrations ?? 0;
                    return (
                      <td
                        key={h.key}
                        title={`${r.name} · ${h.label}: ${p?.events ?? 0} events, ${v} registrations`}
                        className="rounded text-center tabular-nums"
                        style={{ background: p && p.events ? `color-mix(in srgb, var(--brand) ${Math.max(12, (v / hmMax) * 85)}%, transparent)` : "transparent", minWidth: 36, height: 28 }}
                      >
                        {p && p.events ? v : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {quiet.length > 0 && (
        <section className="mt-6 card">
          <h2 className="mb-2 font-semibold">No events in this period ({quiet.length})</h2>
          <div className="flex flex-wrap gap-2">
            {quiet.map((c) => <Link key={c.club_id} href={`/dashboard/clubs/${c.slug}`} className="badge hover:bg-black/5 dark:hover:bg-white/10">{c.name}</Link>)}
          </div>
        </section>
      )}
    </>
  );
}

async function LeadHome() {
  const clubs = await getManagedClubs();
  if (clubs.length === 1) redirect(`/dashboard/clubs/${clubs[0].slug}`);
  return (
    <>
      <PageHeader title="My clubs" />
      {clubs.length === 0 ? (
        <Empty>No club is assigned to your account yet. Ask the club admin to assign you.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <Link key={c.id} href={`/dashboard/clubs/${c.slug}`} className="card transition hover:shadow-md" style={{ borderTop: `3px solid ${c.accent_color}` }}>
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-sm text-muted">{c.category}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
