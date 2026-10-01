"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireClubAccess, requireProfile } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv";
import { fromLocalInput, int, safeUrl, str } from "@/lib/format";
import { duplicateEventRow } from "@/lib/events";
import { validatePasswordChange } from "@/lib/password";
import type { ClubEvent } from "@/lib/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Redirect back with a flash message in the query string. */
function go(path: string, kind: "ok" | "error", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/* ------------------------------------------------------------------ clubs */

export async function createClubAction(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name"));
  const category = str(formData.get("category")) ?? "General";
  if (!name) return go("/dashboard/clubs", "error", "Club name is required.");
  const slug = slugify(str(formData.get("slug")) ?? name);
  if (!slug) return go("/dashboard/clubs", "error", "Could not build a URL slug from that name.");

  const supabase = await createClient();
  const { error } = await supabase.from("clubs").insert({ name, slug, category });
  if (error) return go("/dashboard/clubs", "error", error.code === "23505" ? "A club with that URL slug already exists." : "Could not create club.");
  revalidatePath("/", "layout");
  redirect(`/dashboard/clubs/${slug}/settings?ok=${encodeURIComponent("Club created — fill in its details.")}`);
}

export async function saveClubAction(slug: string, formData: FormData) {
  const { club, profile } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/settings`;
  const name = str(formData.get("name"));
  if (!name) return go(back, "error", "Club name is required.");

  const patch: Record<string, unknown> = {
    name,
    tagline: str(formData.get("tagline")),
    description: str(formData.get("description")),
    contact_email: str(formData.get("contact_email")),
    instagram_url: safeUrl(formData.get("instagram_url")),
    linkedin_url: safeUrl(formData.get("linkedin_url")),
    whatsapp_url: safeUrl(formData.get("whatsapp_url")),
    website_url: safeUrl(formData.get("website_url")),
    join_form_url: safeUrl(formData.get("join_form_url")),
    faculty_advisor: str(formData.get("faculty_advisor")),
    meeting_schedule: str(formData.get("meeting_schedule")),
    founded_year: int(formData.get("founded_year")),
  };
  const color = str(formData.get("accent_color"));
  if (color && /^#[0-9a-f]{6}$/i.test(color)) patch.accent_color = color;
  if (profile.role === "super_admin") {
    patch.category = str(formData.get("category")) ?? club.category;
    patch.is_active = formData.get("is_active") === "on";
  }

  const supabase = await createClient();
  const { error } = await supabase.from("clubs").update(patch).eq("id", club.id);
  if (error) return go(back, "error", "Could not save changes.");
  revalidatePath("/", "layout");
  return go(back, "ok", "Club settings saved.");
}

/* ----------------------------------------------------------------- events */

export async function saveEventAction(slug: string, eventId: string | null, formData: FormData) {
  const { club } = await requireClubAccess(slug);
  const back = eventId ? `/dashboard/clubs/${slug}/events/${eventId}` : `/dashboard/clubs/${slug}/events/new`;

  const title = str(formData.get("title"));
  const starts_at = fromLocalInput(String(formData.get("starts_at") ?? ""));
  const ends_at = fromLocalInput(String(formData.get("ends_at") ?? ""));
  if (!title || !starts_at) return go(back, "error", "Title and start time are required.");
  if (ends_at && new Date(ends_at) < new Date(starts_at)) return go(back, "error", "End time must be after the start time.");

  const capacity = int(formData.get("capacity"));
  const status = String(formData.get("status"));
  const row = {
    title,
    description: str(formData.get("description")),
    category: str(formData.get("category")) ?? "Workshop",
    venue: str(formData.get("venue")),
    starts_at,
    ends_at,
    capacity: capacity && capacity > 0 ? capacity : null,
    registration_url: safeUrl(formData.get("registration_url")),
    feedback_url: safeUrl(formData.get("feedback_url")),
    registration_open: formData.get("registration_open") === "on",
    status: status === "draft" || status === "cancelled" ? status : "published",
    budget_allocated: Math.max(0, Number(formData.get("budget_allocated")) || 0),
    budget_spent: Math.max(0, Number(formData.get("budget_spent")) || 0),
  };

  const supabase = await createClient();
  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId).eq("club_id", club.id);
    if (error) return go(back, "error", "Could not save event.");
    revalidatePath("/", "layout");
    return go(back, "ok", "Event saved.");
  }
  const { data, error } = await supabase.from("events").insert({ ...row, club_id: club.id }).select("id").single();
  if (error || !data) return go(back, "error", "Could not create event.");
  revalidatePath("/", "layout");
  return go(`/dashboard/clubs/${slug}/events/${data.id}`, "ok", "Event created.");
}

export async function deleteEventAction(slug: string, eventId: string) {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId).eq("club_id", club.id);
  if (error) return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not delete event.");
  revalidatePath("/", "layout");
  return go(`/dashboard/clubs/${slug}/events`, "ok", "Event deleted.");
}

/* ----------------------------------------------------------- participants */

export async function addParticipantAction(slug: string, eventId: string, formData: FormData) {
  await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/events/${eventId}`;
  const full_name = str(formData.get("full_name"));
  const email = str(formData.get("email"))?.toLowerCase();
  if (!full_name || !email || !EMAIL.test(email)) return go(back, "error", "A name and a valid email are required.");

  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    full_name,
    email,
    roll_no: str(formData.get("roll_no")),
    department: str(formData.get("department")),
    year: int(formData.get("year")),
    phone: str(formData.get("phone")),
    attended: formData.get("attended") === "on",
    attended_at: formData.get("attended") === "on" ? new Date().toISOString() : null,
  });
  if (error) return go(back, "error", error.code === "23505" ? "That email is already registered." : "Could not add participant.");
  return go(back, "ok", "Participant added.");
}

export async function duplicateEventAction(slug: string, eventId: string) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/events/${eventId}`;
  const supabase = await createClient();
  const { data: src } = await supabase.from("events").select("*").eq("id", eventId).eq("club_id", club.id).maybeSingle();
  if (!src) return go(`/dashboard/clubs/${slug}/events`, "error", "Event not found.");
  const { data, error } = await supabase.from("events").insert(duplicateEventRow(src as ClubEvent)).select("id").single();
  if (error || !data) return go(back, "error", "Could not duplicate the event.");
  revalidatePath("/", "layout");
  return go(`/dashboard/clubs/${slug}/events/${data.id}`, "ok", "Event duplicated as draft");
}

export async function toggleAttendanceAction(slug: string, eventId: string, regId: string, attended: boolean) {
  await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .update({ attended, attended_at: attended ? new Date().toISOString() : null })
    .eq("id", regId)
    .eq("event_id", eventId);
  if (error) return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not update attendance.");
  revalidatePath(`/dashboard/clubs/${slug}/events/${eventId}`);
}

export async function removeParticipantAction(slug: string, eventId: string, regId: string) {
  await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("id", regId).eq("event_id", eventId);
  if (error) return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not remove the participant.");
  revalidatePath(`/dashboard/clubs/${slug}/events/${eventId}`);
}

/* ---------------------------------------------------------------- members */

type MemberInput = {
  full_name: string; email: string | null; roll_no: string | null; department: string | null;
  year: number | null; phone: string | null; position: string;
};

export async function addMemberAction(slug: string, formData: FormData) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/members`;
  const full_name = str(formData.get("full_name"));
  if (!full_name) return go(back, "error", "Member name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").insert({
    club_id: club.id,
    full_name,
    email: str(formData.get("email"))?.toLowerCase() ?? null,
    roll_no: str(formData.get("roll_no")),
    department: str(formData.get("department")),
    year: int(formData.get("year")),
    phone: str(formData.get("phone")),
    position: str(formData.get("position")) ?? "Member",
  });
  if (error) return go(back, "error", "Could not add member.");
  return go(back, "ok", "Member added.");
}

/** Bulk-add members from pasted CSV rows: name, email, roll no, department, year, phone, position */
export async function importMembersAction(slug: string, formData: FormData) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/members`;
  const lines = parseCsv(String(formData.get("csv") ?? ""));
  const rows: (MemberInput & { club_id: string })[] = [];
  let skipped = 0;
  for (const line of lines) {
    const [name, email, roll, dept, year, phone, position] = line.map((c) => c.trim());
    if (!name || /^name$/i.test(name)) continue; // skip header
    if (email && !EMAIL.test(email)) { skipped++; continue; }
    rows.push({
      club_id: club.id,
      full_name: name,
      email: email ? email.toLowerCase() : null,
      roll_no: roll || null,
      department: dept || null,
      year: year ? parseInt(year, 10) || null : null,
      phone: phone || null,
      position: position || "Member",
    });
  }
  if (rows.length === 0) return go(back, "error", "No valid rows found. Use: name, email, roll no, department, year, phone, position");
  if (rows.length > 500) return go(back, "error", "Please import at most 500 rows at a time.");
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").insert(rows);
  if (error) return go(back, "error", "Import failed — nothing was added.");
  return go(back, "ok", `Imported ${rows.length} members.${skipped ? ` Skipped ${skipped} row(s) with an invalid email.` : ""}`);
}

export async function setMemberStatusAction(slug: string, memberId: string, status: "active" | "alumni" | "inactive") {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").update({ status }).eq("id", memberId).eq("club_id", club.id);
  if (error) return go(`/dashboard/clubs/${slug}/members`, "error", "Could not update the member's status.");
  revalidatePath(`/dashboard/clubs/${slug}/members`);
}

export async function removeMemberAction(slug: string, memberId: string) {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").delete().eq("id", memberId).eq("club_id", club.id);
  if (error) return go(`/dashboard/clubs/${slug}/members`, "error", "Could not remove the member.");
  revalidatePath(`/dashboard/clubs/${slug}/members`);
}

/* ---------------------------------------------------------- announcements */

export async function addAnnouncementAction(slug: string, formData: FormData) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/announcements`;
  const title = str(formData.get("title"));
  if (!title) return go(back, "error", "Title is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    club_id: club.id, title, body: str(formData.get("body")), pinned: formData.get("pinned") === "on",
  });
  if (error) return go(back, "error", "Could not post announcement.");
  revalidatePath("/", "layout");
  return go(back, "ok", "Announcement posted.");
}

export async function deleteAnnouncementAction(slug: string, id: string) {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id).eq("club_id", club.id);
  if (error) return go(`/dashboard/clubs/${slug}/announcements`, "error", "Could not delete the announcement.");
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------ club leads */

export async function createLeadAction(formData: FormData) {
  await requireAdmin();
  const back = "/dashboard/leads";
  const email = str(formData.get("email"))?.toLowerCase();
  const full_name = str(formData.get("full_name"));
  const password = String(formData.get("password") ?? "");
  const clubIds = formData.getAll("clubs").map(String);
  if (!email || !EMAIL.test(email)) return go(back, "error", "A valid email is required.");
  if (password.length < 8) return go(back, "error", "Password must be at least 8 characters.");

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: full_name ?? email.split("@")[0] },
  });
  if (error || !data.user) {
    return go(back, "error", /already|registered/i.test(error?.message ?? "") ? "An account with that email already exists — assign it to a club below instead." : "Could not create the account.");
  }
  if (full_name) {
    const { error: nameErr } = await svc.from("profiles").update({ full_name }).eq("id", data.user.id);
    if (nameErr) return go(back, "error", `Account created for ${email}, but saving the name failed.`);
  }
  if (clubIds.length) {
    const { error: assignErr } = await svc.from("club_leads").insert(clubIds.map((club_id) => ({ club_id, user_id: data.user.id })));
    if (assignErr) return go(back, "error", "Account created but club assignment failed — assign it below.");
  }
  revalidatePath("/dashboard/leads");
  return go(back, "ok", `Lead account created for ${email}.`);
}

export async function assignLeadAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  const clubId = String(formData.get("club_id"));
  if (!userId || !clubId) return go("/dashboard/leads", "error", "Pick a club.");
  const supabase = await createClient();
  const { error } = await supabase.from("club_leads").upsert({ club_id: clubId, user_id: userId });
  if (error) return go("/dashboard/leads", "error", "Could not assign the lead to that club.");
  revalidatePath("/dashboard/leads");
}

export async function unassignLeadAction(userId: string, clubId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("club_leads").delete().eq("user_id", userId).eq("club_id", clubId);
  if (error) return go("/dashboard/leads", "error", "Could not unassign the lead.");
  revalidatePath("/dashboard/leads");
}

/* ---------------------------------------------------------------- account */

export async function changePasswordAction(formData: FormData) {
  const profile = await requireProfile();
  const back = "/dashboard/account";
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const invalid = validatePasswordChange(current, next, String(formData.get("confirm") ?? ""));
  if (invalid) return go(back, "error", invalid);
  if (!profile.email) return go(back, "error", "Your account has no email on file.");

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
  if (verifyErr) return go(back, "error", "Current password is incorrect.");
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return go(back, "error", "Could not update the password.");
  return go(back, "ok", "Password updated.");
}
