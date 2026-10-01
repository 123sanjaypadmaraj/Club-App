import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Club, Profile } from "@/lib/types";

/** Current profile or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("id, full_name, email, role").eq("id", auth.user.id).single();
  return (data as Profile) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  return p;
}

export async function requireAdmin(): Promise<Profile> {
  const p = await requireProfile();
  if (p.role !== "super_admin") redirect("/dashboard");
  return p;
}

/** Clubs the current user may manage (all for admin). */
export const getManagedClubs = cache(async (): Promise<Club[]> => {
  const p = await getProfile();
  if (!p) return [];
  const supabase = await createClient();
  if (p.role === "super_admin") {
    const { data } = await supabase.from("clubs").select("*").order("name");
    return (data as Club[]) ?? [];
  }
  const { data } = await supabase.from("club_leads").select("clubs(*)").eq("user_id", p.id);
  return ((data ?? []).map((r: { clubs: unknown }) => r.clubs) as Club[]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
});

/** Load a club by slug and make sure the user may manage it; otherwise 404. */
export async function requireClubAccess(slug: string): Promise<{ profile: Profile; club: Club }> {
  const profile = await requireProfile();
  const clubs = await getManagedClubs();
  const club = clubs.find((c) => c.slug === slug);
  if (!club) notFound();
  return { profile, club };
}
