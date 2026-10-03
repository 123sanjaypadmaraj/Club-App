import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { buildSitemap, siteOrigin } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin) return [];
  // anon client: RLS keeps drafts and cancelled events out
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: clubs }, { data: events }] = await Promise.all([
    supabase.from("clubs").select("slug").eq("is_active", true),
    supabase.from("events").select("id, starts_at, created_at").eq("status", "published").limit(1000),
  ]);
  return buildSitemap(origin, clubs ?? [], events ?? []);
}
