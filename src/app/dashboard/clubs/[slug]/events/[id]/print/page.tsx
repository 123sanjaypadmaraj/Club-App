import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireClubAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { fmtDateTime } from "@/lib/format";
import { sortRegistrations } from "@/lib/participants";
import type { ClubEvent, Registration } from "@/lib/types";

export const metadata = { title: "Print" };

export default async function PrintPage({ params, searchParams }: PageProps<"/dashboard/clubs/[slug]/events/[id]/print">) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { club } = await requireClubAccess(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const mode = sp.mode === "badges" ? "badges" : "sheet";

  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("*").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!ev) notFound();
  const event = ev as ClubEvent;
  const { data } = await supabase.from("event_registrations").select("*").eq("event_id", id).eq("status", "confirmed");
  const regs = sortRegistrations((data as Registration[]) ?? [], "name");

  const base = `/dashboard/clubs/${slug}/events/${id}/print`;
  const qrs = mode === "badges" ? await Promise.all(regs.map((r) => QRCode.toString(r.ticket_code, { type: "svg", margin: 0, width: 96 }))) : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/dashboard/clubs/${slug}/events/${id}`} className="text-sm text-brand hover:underline">← Back to event</Link>
        <div className="ml-auto flex gap-2">
          <Link href={`${base}?mode=sheet`} className={`btn ${mode === "sheet" ? "btn-primary" : ""}`}>Attendance sheet</Link>
          <Link href={`${base}?mode=badges`} className={`btn ${mode === "badges" ? "btn-primary" : ""}`}>Name badges</Link>
          <PrintButton label="🖨 Print" className="btn btn-primary" />
        </div>
      </div>

      {mode === "sheet" ? (
        <div className="bg-white p-2 text-black">
          <h1 className="text-lg font-bold">{event.title} — attendance sheet</h1>
          <p className="mb-3 text-sm">{club.name} · {fmtDateTime(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""} · {regs.length} registered</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="w-8 py-1">#</th><th>Name</th><th>Roll no</th><th>Dept / Yr</th><th>Phone</th><th className="w-14 text-center">Present</th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-300 [break-inside:avoid]">
                  <td className="py-1.5 text-gray-500">{i + 1}</td>
                  <td className="font-medium">{r.full_name}</td>
                  <td>{r.roll_no}</td>
                  <td>{[r.department, r.year && `Y${r.year}`].filter(Boolean).join(" ")}</td>
                  <td>{r.phone}</td>
                  <td className="text-center">{r.attended ? "✓" : <span className="inline-block size-4 border border-black align-middle" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {regs.length === 0 && <p className="py-6 text-center text-gray-500">No confirmed registrations.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 bg-white p-2 text-black sm:grid-cols-3">
          {regs.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-gray-400 p-3 [break-inside:avoid]">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{club.name}</div>
                <div className="truncate text-lg font-bold leading-tight">{r.full_name}</div>
                <div className="truncate text-xs text-gray-700">{[r.department, r.year && `Year ${r.year}`].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-gray-500">{r.ticket_code}</div>
              </div>
              <div className="size-16 shrink-0" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            </div>
          ))}
          {regs.length === 0 && <p className="col-span-full py-6 text-center text-gray-500">No confirmed registrations.</p>}
        </div>
      )}
    </div>
  );
}
