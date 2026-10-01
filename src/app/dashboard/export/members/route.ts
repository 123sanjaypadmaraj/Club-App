import { NextRequest } from "next/server";
import { getManagedClubs, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import type { Member } from "@/lib/types";

export async function GET(req: NextRequest) {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const slug = req.nextUrl.searchParams.get("club") ?? "";
  const club = (await getManagedClubs()).find((c) => c.slug === slug);
  if (!club) return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase.from("club_members").select("*").eq("club_id", club.id).order("full_name");
  const rows = ((data as Member[]) ?? []).map((m) => ({
    Name: m.full_name,
    Email: m.email,
    "Roll no": m.roll_no,
    Department: m.department,
    Year: m.year,
    Phone: m.phone,
    Position: m.position,
    Status: m.status,
    "Joined on": m.joined_on,
  }));
  return csvResponse(`members-${club.slug}.csv`, toCsv(rows, ["Name", "Email", "Roll no", "Department", "Year", "Phone", "Position", "Status", "Joined on"]));
}
