import Link from "next/link";
import { requireClubAccess } from "@/lib/auth";
import { getEventStats } from "@/lib/data";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { Stars } from "@/components/charts";
import { Empty, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Club events" };

export default async function EventsTab({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/events">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  const stats = await getEventStats(club.id);

  return (
    <>
      <PageHeader title="Events" subtitle={`${stats.length} total`} actions={<Link href={`/dashboard/clubs/${slug}/events/new`} className="btn btn-primary">+ New event</Link>} />
      <Notice ok={typeof sp.ok === "string" ? sp.ok : undefined} error={typeof sp.error === "string" ? sp.error : undefined} />
      {stats.length === 0 ? (
        <Empty>No events yet. Create your first one.</Empty>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Event</th><th className="th">Date</th><th className="th">Status</th>
                <th className="th text-right">Registered</th><th className="th text-right">Attended</th><th className="th">Rating</th><th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.map((e) => (
                <tr key={e.event_id} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  <td className="td font-medium"><Link href={`/dashboard/clubs/${slug}/events/${e.event_id}`} className="hover:text-brand hover:underline">{e.title}</Link></td>
                  <td className="td text-muted">{fmtDateTime(e.starts_at)}</td>
                  <td className="td"><span className="badge">{e.status}</span></td>
                  <td className="td text-right tabular-nums">{fmtNum(e.registrations)}{e.capacity ? ` / ${e.capacity}` : ""}</td>
                  <td className="td text-right tabular-nums">{fmtNum(e.attendees)}</td>
                  <td className="td"><Stars value={e.avg_rating == null ? null : Number(e.avg_rating)} /> <span className="text-xs text-muted">({e.feedback_count})</span></td>
                  <td className="td text-right"><Link href={`/dashboard/clubs/${slug}/events/${e.event_id}#edit`} className="btn !py-1">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
