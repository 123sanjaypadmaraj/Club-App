import { NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { getClubSummaries, getEventStats } from "@/lib/data";
import { csvResponse, toCsv } from "@/lib/csv";
import { groupBy, inRange, parseRange, totals } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (profile?.role !== "super_admin") return new Response("Forbidden", { status: 403 });

  const range = parseRange(req.nextUrl.searchParams.get("range") ?? undefined);
  const [stats, clubs] = await Promise.all([getEventStats(), getClubSummaries()]);
  const byClub = groupBy(inRange(stats, range), (s) => s.club_id);

  const rows = clubs.map((c) => {
    const t = totals(byClub.get(c.club_id) ?? []);
    return {
      Club: c.name,
      Category: c.category,
      Active: c.is_active ? "yes" : "no",
      "Active members": c.active_members,
      Events: t.events,
      Registrations: t.registrations,
      Attended: t.attendees,
      "Attendance %": t.attendanceRate ?? "",
      "Avg rating": t.avgRating ?? "",
      "Feedback responses": t.feedbackCount,
      "Budget allocated": t.budgetAllocated,
      "Budget spent": t.budgetSpent,
    };
  });
  return csvResponse(`club-performance-${range}.csv`, toCsv(rows));
}
