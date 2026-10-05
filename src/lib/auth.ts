import { flashQuery } from "@/lib/flash";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Club, Profile } from "@/lib/types";
import { authAgeSeconds } from "@/lib/authage";

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

/**
 * Admin accounts can create, reset and delete every lead, so they must sign in with a second step (TOTP).
 * "ok" = this session has passed it; "verify" = enrolled but not yet verified; "enroll" = no authenticator set up.
 * Set ADMIN_MFA=off to disable (emergency escape hatch only).
 */
export async function adminMfaState(): Promise<"ok" | "verify" | "enroll"> {
  if (process.env.ADMIN_MFA === "off") return "ok";
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return "ok";
  return data?.nextLevel === "aal2" ? "verify" : "enroll";
}

export async function requireAdmin(): Promise<Profile> {
  const p = await requireProfile();
  if (p.role !== "super_admin") redirect("/dashboard");
  const mfa = await adminMfaState();
  if (mfa === "verify") redirect("/login/mfa?next=/dashboard");
  if (mfa === "enroll") redirect("/dashboard/account?" + flashQuery("error", "Admin accounts must set up two-step login before using admin pages."));
  return p;
}

/**
 * Before destructive admin actions (creating, resetting or deleting accounts, creating clubs) ask for a fresh
 * authenticator code if the last one is older than `maxAgeSec`. Stops a hijacked, already-verified session doing damage unnoticed.
 */
export async function requireRecentAdminAuth(next: string, maxAgeSec = 900): Promise<void> {
  if (process.env.ADMIN_MFA === "off") return;
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (authAgeSeconds(data?.currentAuthenticationMethods, Date.now()) > maxAgeSec) {
    redirect(`/login/mfa?next=${encodeURIComponent(next)}&${flashQuery("error", "Confirm with your authenticator code to continue.")}`);
  }
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
  // an admin without a completed second step must not read any club's personal data
  if (profile.role === "super_admin") {
    const mfa = await adminMfaState();
    if (mfa === "verify") redirect("/login/mfa?next=/dashboard");
    if (mfa === "enroll") redirect("/dashboard/account?" + flashQuery("error", "Admin accounts must set up two-step login before using admin pages."));
  }
  return { profile, club };
}
