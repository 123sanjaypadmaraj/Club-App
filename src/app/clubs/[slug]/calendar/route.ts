import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { eventsToIcs } from "@/lib/ics";
import { siteOrigin } from "@/lib/seo";
import { logActionError } from "@/lib/log";

const WINDOW_DAYS = 90;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  // anon-readable client: RLS hides drafts
  const supabase = await createClient();
  const { data: club, error: clubErr } = await supabase.from("clubs").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (clubErr) {
    logActionError("clubCalendar", clubErr, { slug });
    return new Response("Something went wrong", { status: 500 });
  }
  if (!club) return new Response("Not found", { status: 404 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, venue, description")
    .eq("club_id", club.id)
    .eq("status", "published")
    .gte("starts_at", since)
    .order("starts_at")
    .limit(500);

  if (error) {
    logActionError("clubCalendar", error, { slug });
    return new Response("Something went wrong", { status: 500 });
  }

  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? req.nextUrl.origin;
  const body = eventsToIcs((data ?? []).map((e) => ({ ...e, url: `${origin}/events/${e.id}` })), club.name);
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
