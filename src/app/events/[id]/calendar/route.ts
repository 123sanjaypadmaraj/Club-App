import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { eventToIcs } from "@/lib/ics";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, venue, description, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });

  const body = eventToIcs({ ...data, url: new URL(`/events/${data.id}`, req.nextUrl.origin).toString() });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${data.id}.ics"`,
    },
  });
}
