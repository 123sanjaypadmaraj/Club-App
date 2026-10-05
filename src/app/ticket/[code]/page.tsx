import { safeColor } from "@/lib/safe";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { fmtDateTime } from "@/lib/format";
import { parseTicketCode } from "@/lib/tickets";
import { clientIp, LIMITS_POLICY, rateLimit } from "@/lib/ratelimit";

export const metadata = { title: "Your ticket", robots: { index: false, follow: false } };

type Ticket = {
  full_name: string; status: "confirmed" | "waitlisted"; attended: boolean; ticket_code: string; waitlist_position: number | null;
  event_id: string; title: string; starts_at: string; ends_at: string | null; venue: string | null;
  club_name: string; club_slug: string; accent_color: string; event_status: string;
};

export default async function TicketPage({ params, searchParams }: PageProps<"/ticket/[code]">) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = parseTicketCode(raw);
  if (!code) notFound();

  // Ticket codes are bearer secrets: throttle lookups so they cannot be guessed in bulk.
  if (!(await rateLimit("ticket", await clientIp(), LIMITS_POLICY.ticket.max, LIMITS_POLICY.ticket.window))) {
    return <p className="mx-auto max-w-md text-center text-sm text-muted">Too many lookups. Please wait a few minutes and try again.</p>;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("ticket_lookup", { p_code: code });
  const t = (data as Ticket[] | null)?.[0];
  if (!t) notFound();

  const waitlisted = t.status === "waitlisted";
  const cancelled = t.event_status === "cancelled";
  // The QR carries just the code: small, so it scans fast even on a cracked phone screen.
  const qr = await QRCode.toString(t.ticket_code, { type: "svg", margin: 1, width: 224, errorCorrectionLevel: "M" });

  return (
    <div className="mx-auto max-w-md space-y-4">
      {sp.new && (
        <div role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {waitlisted
            ? "You're on the waitlist. If a seat opens up, this same ticket turns into a confirmed one automatically."
            : "You're registered! Save this page — show the QR code at the entrance."}
        </div>
      )}

      <article className="card text-center" style={{ borderTop: `4px solid ${safeColor(t.accent_color)}` }}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.club_name}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {fmtDateTime(t.starts_at)}
          {t.venue ? ` · ${t.venue}` : ""}
        </p>

        <div className="my-5">
          <p className="text-lg font-semibold">{t.full_name}</p>
          {cancelled ? (
            <span className="badge mt-1 border-red-500/40 text-red-600">Event cancelled</span>
          ) : waitlisted ? (
            <span className="badge mt-1 border-amber-500/40 text-amber-700 dark:text-amber-300">Waitlist #{t.waitlist_position}</span>
          ) : t.attended ? (
            <span className="badge mt-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">✓ Checked in</span>
          ) : (
            <span className="badge mt-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Confirmed</span>
          )}
        </div>

        {!waitlisted && !cancelled && (
          <>
            {/* white tile so the code stays scannable in dark mode */}
            <div className="mx-auto w-fit rounded-xl bg-white p-2" role="img" aria-label={`QR code for ticket ${t.ticket_code}`} dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-2 font-mono text-lg tracking-[0.3em]">{t.ticket_code}</p>
            <p className="text-xs text-muted">Can&apos;t scan? Read this code out at the desk.</p>
          </>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2 print:hidden">
          <a href={`/events/${t.event_id}/calendar`} className="btn">Add to calendar</a>
          <PrintButton label="Print / save PDF" />
          <Link href={`/events/${t.event_id}`} className="btn">Event page</Link>
        </div>
      </article>

      <p className="text-center text-xs text-muted print:hidden">
        Anyone with this link can see this ticket — don&apos;t share it publicly.
      </p>
    </div>
  );
}
