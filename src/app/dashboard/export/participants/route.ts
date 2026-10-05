import { NextRequest } from "next/server";
import { adminMfaState, getManagedClubs, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { logActionError } from "@/lib/log";
import { displayEmail } from "@/lib/participants";
import type { Registration } from "@/lib/types";

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "super_admin" && (await adminMfaState()) !== "ok") return new Response("Forbidden", { status: 403 });
  const eventId = req.nextUrl.searchParams.get("event") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return new Response("Bad request", { status: 400 });

  const supabase = await createClient();
  const { data: event, error: eventErr } = await supabase.from("events").select("title, club_id").eq("id", eventId).maybeSingle();
  if (eventErr) {
    logActionError("exportParticipants", eventErr, { eventId });
    return new Response("Something went wrong", { status: 500 });
  }
  const managed = await getManagedClubs();
  if (!event || !managed.some((c) => c.id === event.club_id)) return new Response("Forbidden", { status: 403 });

  const { data, error } = await supabase.from("event_registrations").select("*").eq("event_id", eventId).order("registered_at");
  if (error) {
    logActionError("exportParticipants", error, { eventId });
    return new Response("Something went wrong", { status: 500 });
  }
  const rows = ((data as Registration[]) ?? []).map((r) => ({
    Name: r.full_name,
    Email: displayEmail(r.email),
    "Roll no": r.roll_no,
    Department: r.department,
    Year: r.year,
    Phone: r.phone,
    Status: r.status,
    Ticket: r.ticket_code,
    Attended: r.attended ? "yes" : "no",
    "Checked in at": r.attended_at,
    "Registered at": r.registered_at,
  }));
  await audit(profile.id, AUDIT_ACTIONS.exportParticipants, eventId, { rows: rows.length });
  return csvResponse(`participants-${event.title}.csv`, toCsv(rows, ["Name", "Email", "Roll no", "Department", "Year", "Phone", "Status", "Ticket", "Attended", "Checked in at", "Registered at"]));
}
