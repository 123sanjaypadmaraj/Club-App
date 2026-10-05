"use server";

import { flashQuery } from "@/lib/flash";
import { LEAD_EVENT_COLUMNS } from "@/lib/eventColumns";
import { isEmail, MAX_IMPORT_BYTES } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/log";
import { validateLengths } from "@/lib/limits";
import { redirect } from "next/navigation";
import { requireAdmin, requireClubAccess, requireProfile, requireRecentAdminAuth } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv";
import { fromLocalInput, int, safeUrl, str } from "@/lib/format";
import { duplicateEventRow } from "@/lib/events";
import { newTicketCode, parseTicketCode } from "@/lib/tickets";
import { parseParticipantRows, placeholderEmail } from "@/lib/participants";
import { sheetCsvUrl } from "@/lib/sheets";
import { dedupeMembers } from "@/lib/members";
import { validatePasswordChange, weakPasswordReason } from "@/lib/password";
import { LIMITS_POLICY, rateLimit } from "@/lib/ratelimit";
import { audit, AUDIT_ACTIONS } from "@/lib/audit";
import type { ClubEvent, Registration } from "@/lib/types";


/** Redirect back with a flash message in the query string. */
function go(path: string, kind: "ok" | "error", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${flashQuery(kind, msg)}`);
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/* ------------------------------------------------------------------ clubs */

export async function createClubAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireRecentAdminAuth("/dashboard/clubs");
  const name = str(formData.get("name"));
  const category = str(formData.get("category")) ?? "General";
  if (!name) return go("/dashboard/clubs", "error", "Club name is required.");
  const slug = slugify(str(formData.get("slug")) ?? name);
  if (!slug) return go("/dashboard/clubs", "error", "Could not build a URL slug from that name.");

  const supabase = await createClient();
  const { error } = await supabase.from("clubs").insert({ name, slug, category });
  if (error) { logActionError("createClubAction", error); return go("/dashboard/clubs", "error", error.code === "23505" ? "A club with that URL slug already exists." : "Could not create club."); }
  await audit(admin.id, AUDIT_ACTIONS.clubCreated, slug);
  revalidatePath("/", "layout");
  redirect(`/dashboard/clubs/${slug}/settings?${flashQuery("ok", "Club created — fill in its details.")}`);
}

export async function saveClubAction(slug: string, formData: FormData) {
  const { club, profile } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/settings`;
  const name = str(formData.get("name"));
  if (!name) return go(back, "error", "Club name is required.");
  const tagline = str(formData.get("tagline"));
  const description = str(formData.get("description"));
  const contact_email = str(formData.get("contact_email"));
  const faculty_advisor = str(formData.get("faculty_advisor"));
  const meeting_schedule = str(formData.get("meeting_schedule"));
  const tooLong = validateLengths({ club_name: name, tagline, about: description, faculty_advisor, meeting_schedule, email: contact_email });
  if (tooLong) return go(back, "error", tooLong);
  if (contact_email && !isEmail(contact_email)) return go(back, "error", "Please enter a valid contact email.");

  const patch: Record<string, unknown> = {
    name,
    tagline,
    description,
    contact_email,
    instagram_url: safeUrl(formData.get("instagram_url")),
    linkedin_url: safeUrl(formData.get("linkedin_url")),
    whatsapp_url: safeUrl(formData.get("whatsapp_url")),
    website_url: safeUrl(formData.get("website_url")),
    join_form_url: safeUrl(formData.get("join_form_url")),
    faculty_advisor,
    meeting_schedule,
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
  if (error) { logActionError("saveClubAction", error, { slug }); return go(back, "error", "Could not save changes."); }
  revalidatePath("/", "layout");
  if (profile.role === "super_admin" && patch.is_active !== club.is_active) await audit(profile.id, AUDIT_ACTIONS.clubVisibility, slug, { is_active: Boolean(patch.is_active) });
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
  const description = str(formData.get("description"));
  const venue = str(formData.get("venue"));
  const tooLong = validateLengths({ title, venue, event_description: description });
  if (tooLong) return go(back, "error", tooLong);

  const capacity = int(formData.get("capacity"));
  const status = String(formData.get("status"));
  const sheetInput = safeUrl(formData.get("responses_sheet_url"));
  if (sheetInput && !sheetCsvUrl(sheetInput)) return go(back, "error", "The responses sheet must be a Google Sheets link (docs.google.com/spreadsheets/…).");
  const row = {
    title,
    description,
    category: str(formData.get("category")) ?? "Workshop",
    responses_sheet_url: sheetInput,
    venue,
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
    if (error) { logActionError("saveEventAction", error, { slug, eventId }); return go(back, "error", "Could not save event."); }
    revalidatePath("/", "layout");
    return go(back, "ok", "Event saved.");
  }
  const { data, error } = await supabase.from("events").insert({ ...row, club_id: club.id }).select("id").single();
  if (error || !data) { logActionError("saveEventAction", error, { slug, eventId }); return go(back, "error", "Could not create event."); }
  revalidatePath("/", "layout");
  return go(`/dashboard/clubs/${slug}/events/${data.id}`, "ok", "Event created.");
}

export async function deleteEventAction(slug: string, eventId: string) {
  const { club, profile } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId).eq("club_id", club.id);
  if (error) { logActionError("deleteEventAction", error, { slug, eventId }); return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not delete event."); }
  await audit(profile.id, AUDIT_ACTIONS.eventDeleted, eventId, { club_id: club.id });
  revalidatePath("/", "layout");
  return go(`/dashboard/clubs/${slug}/events`, "ok", "Event deleted.");
}

/* ----------------------------------------------------------- participants */

export async function addParticipantAction(slug: string, eventId: string, formData: FormData) {
  await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/events/${eventId}`;
  const full_name = str(formData.get("full_name"));
  const email = str(formData.get("email"))?.toLowerCase();
  if (!full_name || !email || !isEmail(email)) return go(back, "error", "A name and a valid email are required.");
  const roll_no = str(formData.get("roll_no"));
  const department = str(formData.get("department"));
  const phone = str(formData.get("phone"));
  const tooLong = validateLengths({ full_name, email, roll_no, department, phone });
  if (tooLong) return go(back, "error", tooLong);

  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    full_name,
    email,
    roll_no,
    department,
    year: int(formData.get("year")),
    phone,
    attended: formData.get("attended") === "on",
    attended_at: formData.get("attended") === "on" ? new Date().toISOString() : null,
  });
  if (error) { logActionError("addParticipantAction", error, { slug, eventId }); return go(back, "error", error.code === "23505" ? "That email is already registered." : "Could not add participant."); }
  return go(back, "ok", "Participant added.");
}

export async function duplicateEventAction(slug: string, eventId: string) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/events/${eventId}`;
  const supabase = await createClient();
  const { data: src } = await supabase.from("events").select(LEAD_EVENT_COLUMNS).eq("id", eventId).eq("club_id", club.id).maybeSingle();
  if (!src) return go(`/dashboard/clubs/${slug}/events`, "error", "Event not found.");
  const { data, error } = await supabase.from("events").insert(duplicateEventRow(src as ClubEvent)).select("id").single();
  if (error || !data) { logActionError("duplicateEventAction", error, { slug, eventId }); return go(back, "error", "Could not duplicate the event."); }
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
  if (error) { logActionError("toggleAttendanceAction", error, { slug, eventId, regId }); return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not update attendance."); }
  revalidatePath(`/dashboard/clubs/${slug}/events/${eventId}`);
}

export async function removeParticipantAction(slug: string, eventId: string, regId: string) {
  const { profile } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("id", regId).eq("event_id", eventId);
  if (error) { logActionError("removeParticipantAction", error, { slug, eventId, regId }); return go(`/dashboard/clubs/${slug}/events/${eventId}`, "error", "Could not remove the participant."); }
  await audit(profile.id, AUDIT_ACTIONS.participantsRemoved, eventId, { count: 1 });
  revalidatePath(`/dashboard/clubs/${slug}/events/${eventId}`);
}

/* ------------------------------------------------- event-day operations */
// These return data instead of redirecting: they are called from the live check-in console
// and the participants table, which update in place.

const UUID = /^[0-9a-f-]{36}$/i;
const nowIso = () => new Date().toISOString();

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** All registrations (confirmed + waitlisted) of an event — polled by the check-in console. */
export async function loadRegistrationsAction(slug: string, eventId: string): Promise<ActionResult<{ rows: Registration[] }>> {
  await requireClubAccess(slug);
  if (!UUID.test(eventId)) return { ok: false, error: "Bad event." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_registrations").select("*").eq("event_id", eventId).order("registered_at");
  if (error) { logActionError("loadRegistrationsAction", error, { slug, eventId }); return { ok: false, error: "Could not load participants." }; }
  return { ok: true, rows: (data as Registration[]) ?? [] };
}

/** Check one person in (or undo). */
export async function setAttendanceAction(
  slug: string, eventId: string, regId: string, attended: boolean,
): Promise<ActionResult<{ attended: boolean; attended_at: string | null }>> {
  const { profile } = await requireClubAccess(slug);
  if (!UUID.test(regId)) return { ok: false, error: "Bad participant." };
  const supabase = await createClient();
  const attended_at = attended ? nowIso() : null;
  const { data, error } = await supabase
    .from("event_registrations")
    .update({ attended, attended_at, checked_in_by: attended ? profile.id : null })
    .eq("id", regId).eq("event_id", eventId).eq("status", "confirmed")
    .select("id");
  if (error || !data?.length) { logActionError("setAttendanceAction", error, { slug, eventId, regId }); return { ok: false, error: "Could not update — is this person on the waitlist?" }; }
  return { ok: true, attended, attended_at };
}

export type ScanResult =
  | { ok: true; result: "checked_in" | "already" | "waitlisted"; id: string; name: string; at: string | null }
  | { ok: false; error: string };

/** Check in by scanned/typed ticket code. Never un-checks anyone, so double scans are harmless. */
export async function checkInByCodeAction(slug: string, eventId: string, input: string): Promise<ScanResult> {
  const { profile } = await requireClubAccess(slug);
  const code = parseTicketCode(input);
  if (!code) return { ok: false, error: "That doesn't look like a ticket code." };
  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("event_registrations").select("id, full_name, status, attended, attended_at")
    .eq("event_id", eventId).eq("ticket_code", code).maybeSingle();
  if (!reg) return { ok: false, error: "No ticket with that code for this event." };
  if (reg.status === "waitlisted") return { ok: true, result: "waitlisted", id: reg.id, name: reg.full_name, at: null };
  if (reg.attended) return { ok: true, result: "already", id: reg.id, name: reg.full_name, at: reg.attended_at };
  const at = nowIso();
  const { error } = await supabase
    .from("event_registrations").update({ attended: true, attended_at: at, checked_in_by: profile.id }).eq("id", reg.id);
  if (error) { logActionError("checkInByCodeAction", error, { slug, eventId }); return { ok: false, error: "Could not check in. Try again." }; }
  return { ok: true, result: "checked_in", id: reg.id, name: reg.full_name, at };
}

/** Register someone at the door and mark them present. Email is optional (a placeholder keeps the unique-email rule happy). */
export async function walkInAction(
  slug: string, eventId: string,
  input: { full_name: string; email?: string; phone?: string; department?: string; year?: string },
): Promise<ActionResult<{ row: Registration }>> {
  const { profile } = await requireClubAccess(slug);
  const full_name = input.full_name?.trim();
  if (!full_name) return { ok: false, error: "A name is required." };
  const email = input.email?.trim().toLowerCase();
  if (email && !isEmail(email)) return { ok: false, error: "That email doesn't look right." };
  const tooLong = validateLengths({ full_name, email, phone: input.phone?.trim(), department: input.department?.trim() });
  if (tooLong) return { ok: false, error: tooLong };
  const ticket_code = newTicketCode();
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    full_name,
    email: email || placeholderEmail(ticket_code),
    phone: input.phone?.trim() || null,
    department: input.department?.trim() || null,
    year: int(input.year ?? null),
    ticket_code,
    status: "confirmed",
    attended: true,
    attended_at: nowIso(),
    checked_in_by: profile.id,
  }).select("*").single();
  if (error || !data) { logActionError("walkInAction", error, { slug, eventId }); return { ok: false, error: error?.code === "23505" ? "That email is already registered — search for them instead." : "Could not add them." }; }
  return { ok: true, row: data as Registration };
}

export type BulkOp = "present" | "absent" | "remove" | "promote";

export async function bulkParticipantsAction(
  slug: string, eventId: string, ids: string[], op: BulkOp,
): Promise<ActionResult<{ count: number }>> {
  const { profile } = await requireClubAccess(slug);
  const clean = [...new Set(ids)].filter((i) => UUID.test(i)).slice(0, 500);
  if (clean.length === 0) return { ok: false, error: "Nothing selected." };
  const supabase = await createClient();
  const t = () => supabase.from("event_registrations");
  let res;
  if (op === "remove") {
    res = await t().delete().in("id", clean).eq("event_id", eventId).select("id");
  } else if (op === "promote") {
    res = await t().update({ status: "confirmed" }).in("id", clean).eq("event_id", eventId).eq("status", "waitlisted").select("id");
  } else if (op === "present") {
    res = await t().update({ attended: true, attended_at: nowIso(), checked_in_by: profile.id })
      .in("id", clean).eq("event_id", eventId).eq("status", "confirmed").eq("attended", false).select("id");
  } else {
    res = await t().update({ attended: false, attended_at: null, checked_in_by: null })
      .in("id", clean).eq("event_id", eventId).eq("attended", true).select("id");
  }
  if (res.error) { logActionError("bulkParticipantsAction", res.error, { slug, eventId }); return { ok: false, error: "That didn't work. Nothing was changed." }; }
  if (op === "remove") await audit(profile.id, AUDIT_ACTIONS.participantsRemoved, eventId, { count: res.data?.length ?? 0 });
  revalidatePath(`/dashboard/clubs/${slug}/events/${eventId}`);
  return { ok: true, count: res.data?.length ?? 0 };
}

/** Bulk-add registrations from a CSV (e.g. a Google Forms export). Existing emails are skipped. */
export async function importParticipantsAction(slug: string, eventId: string, formData: FormData) {
  await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/events/${eventId}`;
  const file = formData.get("file");
  if (file instanceof File && file.size > MAX_IMPORT_BYTES) return go(back, "error", "That file is too large. Import at most 1 MB at a time.");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "").slice(0, MAX_IMPORT_BYTES);
  const { valid, invalid, duplicates } = parseParticipantRows(parseCsv(text));
  if (valid.length === 0) return go(back, "error", "No valid rows found. Each row needs a name and a valid email.");
  if (valid.length > 1000) return go(back, "error", "Please import at most 1000 rows at a time.");

  const supabase = await createClient();
  const { data: existing } = await supabase.from("event_registrations").select("email").eq("event_id", eventId);
  const have = new Set((existing ?? []).map((e: { email: string }) => e.email.toLowerCase()));
  const fresh = valid.filter((r) => !have.has(r.email));
  const already = valid.length - fresh.length;
  if (fresh.length === 0) return go(back, "error", `Everyone in that file is already registered (${already}).`);

  const { error } = await supabase.from("event_registrations").insert(
    fresh.map((r) => ({ ...r, event_id: eventId, ticket_code: newTicketCode(), status: "confirmed" })),
  );
  if (error) { logActionError("importParticipantsAction", error, { slug, eventId }); return go(back, "error", "Import failed — nothing was added."); }
  revalidatePath(back);
  const notes = [already && `${already} already registered`, duplicates && `${duplicates} duplicate`, invalid && `${invalid} invalid`].filter(Boolean).join(", ");
  return go(back, "ok", `Imported ${fresh.length} participants.${notes ? ` Skipped: ${notes}.` : ""}`);
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
  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  const roll_no = str(formData.get("roll_no"));
  const department = str(formData.get("department"));
  const phone = str(formData.get("phone"));
  const position = str(formData.get("position")) ?? "Member";
  const tooLong = validateLengths({ full_name, email, roll_no, department, phone, position });
  if (tooLong) return go(back, "error", tooLong);
  if (email && !isEmail(email)) return go(back, "error", "Please enter a valid email address.");
  const supabase = await createClient();
  if (email) {
    const { data: dup } = await supabase.from("club_members").select("id").eq("club_id", club.id).ilike("email", email).limit(1);
    if (dup?.length) return go(back, "error", "A member with that email already exists.");
  }
  const { error } = await supabase.from("club_members").insert({
    club_id: club.id,
    full_name,
    email,
    roll_no,
    department,
    year: int(formData.get("year")),
    phone,
    position,
  });
  if (error) { logActionError("addMemberAction", error, { slug }); return go(back, "error", "Could not add member."); }
  return go(back, "ok", "Member added.");
}

/** Bulk-add members from pasted CSV rows: name, email, roll no, department, year, phone, position */
export async function importMembersAction(slug: string, formData: FormData) {
  const { club, profile } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/members`;
  const lines = parseCsv(String(formData.get("csv") ?? "").slice(0, MAX_IMPORT_BYTES));
  const rows: (MemberInput & { club_id: string })[] = [];
  let skipped = 0;
  for (const line of lines) {
    const [name, email, roll, dept, year, phone, position] = line.map((c) => c.trim());
    if (!name || /^name$/i.test(name)) continue; // skip header
    if (email && !isEmail(email)) { skipped++; continue; }
    if (validateLengths({ full_name: name, email, roll_no: roll, department: dept, phone, position })) { skipped++; continue; }
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
  const { data: existing, error: existingErr } = await supabase.from("club_members").select("email, roll_no").eq("club_id", club.id).limit(5000);
  if (existingErr) { logActionError("importMembersAction", existingErr, { slug }); return go(back, "error", "Import failed — nothing was added."); }
  const { fresh, duplicates } = dedupeMembers(rows, existing ?? []);
  if (fresh.length === 0) return go(back, "error", `Everyone in that list is already a member (${duplicates}).`);
  const { error } = await supabase.from("club_members").insert(fresh);
  if (error) { logActionError("importMembersAction", error, { slug }); return go(back, "error", "Import failed — nothing was added."); }
  await audit(profile.id, AUDIT_ACTIONS.membersImported, club.id, { added: fresh.length, skipped: duplicates + skipped });
  return go(back, "ok", `Imported ${fresh.length} members.${duplicates ? ` Skipped ${duplicates} already on the roster.` : ""}${skipped ? ` Skipped ${skipped} row(s) with an invalid email.` : ""}`);
}

export async function setMemberStatusAction(slug: string, memberId: string, status: "active" | "alumni" | "inactive") {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").update({ status }).eq("id", memberId).eq("club_id", club.id);
  if (error) { logActionError("setMemberStatusAction", error, { slug, memberId }); return go(`/dashboard/clubs/${slug}/members`, "error", "Could not update the member's status."); }
  revalidatePath(`/dashboard/clubs/${slug}/members`);
}

export async function removeMemberAction(slug: string, memberId: string) {
  const { club, profile } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("club_members").delete().eq("id", memberId).eq("club_id", club.id);
  if (error) { logActionError("removeMemberAction", error, { slug, memberId }); return go(`/dashboard/clubs/${slug}/members`, "error", "Could not remove the member."); }
  await audit(profile.id, AUDIT_ACTIONS.memberRemoved, memberId, { club_id: club.id });
  revalidatePath(`/dashboard/clubs/${slug}/members`);
}

/* ---------------------------------------------------------- announcements */

export async function addAnnouncementAction(slug: string, formData: FormData) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/announcements`;
  const title = str(formData.get("title"));
  if (!title) return go(back, "error", "Title is required.");
  const body = str(formData.get("body"));
  const tooLong = validateLengths({ title, body });
  if (tooLong) return go(back, "error", tooLong);
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    club_id: club.id, title, body, pinned: formData.get("pinned") === "on",
  });
  if (error) { logActionError("addAnnouncementAction", error, { slug }); return go(back, "error", "Could not post announcement."); }
  revalidatePath("/", "layout");
  return go(back, "ok", "Announcement posted.");
}

export async function toggleAnnouncementPinAction(slug: string, id: string, pinned: boolean) {
  const { club } = await requireClubAccess(slug);
  const back = `/dashboard/clubs/${slug}/announcements`;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ pinned }).eq("id", id).eq("club_id", club.id);
  if (error) { logActionError("toggleAnnouncementPinAction", error, { slug, announcementId: id }); return go(back, "error", "Could not update the announcement."); }
  revalidatePath("/", "layout");
  return go(back, "ok", pinned ? "Announcement pinned." : "Announcement unpinned.");
}

export async function deleteAnnouncementAction(slug: string, id: string) {
  const { club } = await requireClubAccess(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id).eq("club_id", club.id);
  if (error) { logActionError("deleteAnnouncementAction", error, { slug, announcementId: id }); return go(`/dashboard/clubs/${slug}/announcements`, "error", "Could not delete the announcement."); }
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------ club leads */

export async function createLeadAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireRecentAdminAuth("/dashboard/leads");
  const back = "/dashboard/leads";
  const email = str(formData.get("email"))?.toLowerCase();
  const full_name = str(formData.get("full_name"));
  const password = String(formData.get("password") ?? "");
  const clubIds = formData.getAll("clubs").map(String);
  if (!email || !isEmail(email)) return go(back, "error", "A valid email is required.");
  const weak = weakPasswordReason(password, email);
  if (weak) return go(back, "error", weak);

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: full_name ?? email.split("@")[0] },
    app_metadata: { must_change_password: true }, // the admin knows this password: the lead must replace it
  });
  if (error || !data.user) {
    logActionError("createLeadAction", error);
    return go(back, "error", /already|registered/i.test(error?.message ?? "") ? "An account with that email already exists — assign it to a club below instead." : "Could not create the account.");
  }
  if (full_name) {
    const { error: nameErr } = await svc.from("profiles").update({ full_name }).eq("id", data.user.id);
    if (nameErr) { logActionError("createLeadAction", nameErr); return go(back, "error", `Account created for ${email}, but saving the name failed.`); }
  }
  if (clubIds.length) {
    const { error: assignErr } = await svc.from("club_leads").insert(clubIds.map((club_id) => ({ club_id, user_id: data.user.id })));
    if (assignErr) { logActionError("createLeadAction", assignErr); return go(back, "error", "Account created but club assignment failed — assign it below."); }
  }
  await audit(admin.id, AUDIT_ACTIONS.leadCreated, data.user.id, { clubs: clubIds.length });
  revalidatePath("/dashboard/leads");
  return go(back, "ok", `Lead account created for ${email}.`);
}

export async function resetLeadPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireRecentAdminAuth("/dashboard/leads");
  const back = "/dashboard/leads";
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!UUID.test(userId)) return go(back, "error", "Pick a lead.");
  const svc = createServiceClient();
  const { data: target } = await svc.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  if (!target || target.role !== "club_lead") return go(back, "error", "Only club lead accounts can be reset here.");
  const weak = weakPasswordReason(password, target.email ?? "");
  if (weak) return go(back, "error", weak);
  const { error } = await svc.auth.admin.updateUserById(userId, { password, app_metadata: { must_change_password: true } });
  if (error) { logActionError("resetLeadPasswordAction", error, { userId }); return go(back, "error", "Could not reset the password."); }
  await audit(admin.id, AUDIT_ACTIONS.leadPasswordReset, userId);
  return go(back, "ok", `Password reset for ${target.email}.`);
}

export async function deleteLeadAction(userId: string) {
  const admin = await requireAdmin();
  await requireRecentAdminAuth("/dashboard/leads");
  const back = "/dashboard/leads";
  if (!UUID.test(userId)) return go(back, "error", "Pick a lead.");
  const svc = createServiceClient();
  const { data: target } = await svc.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  if (!target || target.role !== "club_lead") return go(back, "error", "Only club lead accounts can be deleted here.");
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) { logActionError("deleteLeadAction", error, { userId }); return go(back, "error", "Could not delete the account."); }
  await audit(admin.id, AUDIT_ACTIONS.leadDeleted, userId);
  revalidatePath("/dashboard/leads");
  return go(back, "ok", `Deleted the account for ${target.email}.`);
}

export async function clearLeadMfaAction(userId: string) {
  const admin = await requireAdmin();
  await requireRecentAdminAuth("/dashboard/leads");
  const back = "/dashboard/leads";
  if (!UUID.test(userId)) return go(back, "error", "Pick a lead.");
  const svc = createServiceClient();
  const { data: target } = await svc.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  if (!target || target.role !== "club_lead") return go(back, "error", "Only club lead accounts can be changed here.");
  const { data, error } = await svc.auth.admin.mfa.listFactors({ userId });
  if (error) { logActionError("clearLeadMfaAction", error, { userId }); return go(back, "error", "Could not read their authenticators."); }
  for (const f of data?.factors ?? []) {
    const { error: delErr } = await svc.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (delErr) { logActionError("clearLeadMfaAction", delErr, { userId }); return go(back, "error", "Could not clear two-step login."); }
  }
  await audit(admin.id, AUDIT_ACTIONS.leadMfaCleared, userId, { factors: data?.factors?.length ?? 0 });
  return go(back, "ok", `Two-step login cleared for ${target.email}. They can set it up again from My account.`);
}

export async function assignLeadAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id"));
  const clubId = String(formData.get("club_id"));
  if (!UUID.test(userId) || !UUID.test(clubId)) return go("/dashboard/leads", "error", "Pick a club.");
  const supabase = await createClient();
  const { error } = await supabase.from("club_leads").upsert({ club_id: clubId, user_id: userId });
  if (error) { logActionError("assignLeadAction", error); return go("/dashboard/leads", "error", "Could not assign the lead to that club."); }
  revalidatePath("/dashboard/leads");
}

export async function unassignLeadAction(userId: string, clubId: string) {
  await requireAdmin();
  if (!UUID.test(userId) || !UUID.test(clubId)) return go("/dashboard/leads", "error", "Pick a club.");
  const supabase = await createClient();
  const { error } = await supabase.from("club_leads").delete().eq("user_id", userId).eq("club_id", clubId);
  if (error) { logActionError("unassignLeadAction", error, { userId, clubId }); return go("/dashboard/leads", "error", "Could not unassign the lead."); }
  revalidatePath("/dashboard/leads");
}

/* ---------------------------------------------------------------- account */

export async function changePasswordAction(formData: FormData) {
  const profile = await requireProfile();
  const back = "/dashboard/account";
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const invalid = validatePasswordChange(current, next, String(formData.get("confirm") ?? ""), profile.email ?? "");
  if (invalid) return go(back, "error", invalid);
  // the current-password check is itself a password oracle, so throttle it per account
  if (!(await rateLimit("password", profile.id, LIMITS_POLICY.password.max, LIMITS_POLICY.password.window))) return go(back, "error", "Too many attempts. Please wait a few minutes and try again.");
  if (!profile.email) return go(back, "error", "Your account has no email on file.");

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
  if (verifyErr) { logActionError("changePasswordAction", verifyErr); return go(back, "error", "Current password is incorrect."); }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) { logActionError("changePasswordAction", error); return go(back, "error", "Could not update the password."); }
  // they chose their own password now: lift the "must change" flag (a failure here must not hide that the password did change)
  const { error: flagErr } = await createServiceClient().auth.admin.updateUserById(profile.id, { app_metadata: { must_change_password: false } });
  if (flagErr) logActionError("changePasswordAction", flagErr, { userId: profile.id });
  // a changed password should end every other session (a stolen session must not outlive it)
  await supabase.auth.signOut({ scope: "others" });
  await audit(profile.id, AUDIT_ACTIONS.passwordChanged, profile.id);
  return go(back, "ok", "Password updated.");
}
