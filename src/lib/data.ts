import { createClient } from "@/lib/supabase/server";
import type { ClubSummary, EventStat } from "@/lib/types";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

/** Per-event metrics, optionally for one club. Pages through results so nothing is silently truncated. */
export async function getEventStats(clubId?: string): Promise<EventStat[]> {
  const supabase = await createClient();
  const out: EventStat[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("event_stats").select("*").order("starts_at", { ascending: false }).range(from, from + PAGE - 1);
    if (clubId) q = q.eq("club_id", clubId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data as EventStat[]) ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getClubSummaries(): Promise<ClubSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("club_summary").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as ClubSummary[]) ?? [];
}
