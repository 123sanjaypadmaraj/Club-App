import { NextRequest } from "next/server";
import { getManagedClubs, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { displayEmail } from "@/lib/participants";
import type { Registration } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const eventId = req.nextUrl.searchParams.get("event") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return new Response("Bad request", { status: 400 });

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("title, club_id").eq("id", eventId).maybeSingle();
  const managed = await getManagedClubs();
  if (!event || !managed.some((c) => c.id === event.club_id)) return new Response("Forbidden", { status: 403 });

  const { data } = await supabase.from("event_registrations").select("*").eq("event_id", eventId).order("registered_at");
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
  return csvResponse(`participants-${event.title}.csv`, toCsv(rows, ["Name", "Email", "Roll no", "Department", "Year", "Phone", "Status", "Ticket", "Attended", "Checked in at", "Registered at"]));
}
