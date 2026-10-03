import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { eventsToIcs } from "@/lib/ics";
import { siteOrigin } from "@/lib/seo";
import { EVENT_CATEGORIES, pickFilter } from "@/lib/categories";
import { logActionError } from "@/lib/log";

const WINDOW_DAYS = 90;

type Row = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  description: string | null;
  clubs: { name: string; is_active: boolean } | null;
};

export async function GET(req: NextRequest) {
  const category = pickFilter(req.nextUrl.searchParams.get("category") ?? undefined, EVENT_CATEGORIES);
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  // anon-readable client: RLS hides drafts
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select("id, title, starts_at, ends_at, venue, description, clubs!inner(name, is_active)")
    .eq("status", "published")
    .eq("clubs.is_active", true)
    .gte("starts_at", since)
    .order("starts_at")
    .limit(500);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) {
    logActionError("campusCalendar", error);
    return new Response("Something went wrong", { status: 500 });
  }

  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? req.nextUrl.origin;
  const events = ((data ?? []) as unknown as Row[]).map((e) => ({
    id: e.id,
    title: e.clubs ? `${e.clubs.name}: ${e.title}` : e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    venue: e.venue,
    description: e.description,
    url: `${origin}/events/${e.id}`,
  }));
  return new Response(eventsToIcs(events, category ? `Club Hub events: ${category}` : "Club Hub events"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
