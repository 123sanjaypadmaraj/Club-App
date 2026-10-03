import { NextRequest } from "next/server";
import { getManagedClubs, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { fmtDateTime } from "@/lib/format";
import { logActionError } from "@/lib/log";

type Row = {
  rating: number;
  comment: string | null;
  full_name: string | null;
  email: string;
  created_at: string;
  events: { title: string; starts_at: string; club_id: string } | null;
};

export async function GET(req: NextRequest) {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const slug = req.nextUrl.searchParams.get("club") ?? "";
  const club = (await getManagedClubs()).find((c) => c.slug === slug);
  if (!club) return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_feedback")
    .select("rating, comment, full_name, email, created_at, events!inner(title, starts_at, club_id)")
    .eq("events.club_id", club.id)
    .order("created_at", { ascending: false });
  if (error) {
    logActionError("exportFeedback", error, { slug });
    return new Response("Could not export feedback", { status: 500 });
  }
  const rows = ((data as unknown as Row[]) ?? []).map((f) => ({
    Event: f.events?.title ?? "",
    "Event date": f.events ? fmtDateTime(f.events.starts_at) : "",
    Rating: f.rating,
    Comment: f.comment,
    Name: f.full_name,
    Email: f.email,
    "Submitted at": fmtDateTime(f.created_at),
  }));
  return csvResponse(
    `feedback-${club.slug}.csv`,
    toCsv(rows, ["Event", "Event date", "Rating", "Comment", "Name", "Email", "Submitted at"]),
  );
}
