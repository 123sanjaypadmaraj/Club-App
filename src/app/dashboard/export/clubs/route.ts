import { NextRequest } from "next/server";
import { adminMfaState, getProfile } from "@/lib/auth";
import { getClubSummaries, getEventStats } from "@/lib/data";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import { csvResponse, toCsv } from "@/lib/csv";
import { groupBy, inRange, parseRange, totals } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (profile?.role !== "super_admin" || (await adminMfaState()) !== "ok") return new Response("Forbidden", { status: 403 });

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
  await audit(profile.id, AUDIT_ACTIONS.exportClubs, null, { rows: rows.length });
  return csvResponse(`club-performance-${range}.csv`, toCsv(rows));
}
