"use server";

import { redirect } from "next/navigation";
import { logActionError } from "@/lib/log";
import { validateLengths } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";
import { int, str } from "@/lib/format";
import { newTicketCode } from "@/lib/tickets";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public: register for an event. RLS enforces published / open / capacity. */
export async function registerForEvent(eventId: string, formData: FormData) {
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}?${k}=${encodeURIComponent(msg)}`);

  const full_name = str(formData.get("full_name"));
  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  if (!full_name || !email) return back("error", "Name and email are required.");
  if (!EMAIL.test(email)) return back("error", "Please enter a valid email address.");
  const roll_no = str(formData.get("roll_no"));
  const department = str(formData.get("department"));
  const phone = str(formData.get("phone"));
  const tooLong = validateLengths({ full_name, email, roll_no, department, phone });
  if (tooLong) return back("error", tooLong);

  // The code is made here (anonymous visitors can't read their row back) and the DB decides
  // confirmed vs. waitlisted. The ticket page looks it up through a security-definer function.
  const ticket_code = newTicketCode();
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    full_name,
    email,
    roll_no,
    department,
    year: int(formData.get("year")),
    phone,
    ticket_code,
  });

  if (error) {
    if (error.code === "23505") return back("error", "You are already registered for this event.");
    if (error.code === "42501") return back("error", "Registration is closed for this event.");
    logActionError("registerForEvent", error, { eventId });
    return back("error", "Could not register. Please try again.");
  }
  return redirect(`/ticket/${ticket_code}?new=1`);
}

/** Public: submit feedback for an event that has started. */
export async function submitFeedback(eventId: string, formData: FormData) {
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}/feedback?${k}=${encodeURIComponent(msg)}`);

  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  const rating = int(formData.get("rating"));
  if (!email || !EMAIL.test(email)) return back("error", "Please enter a valid email address.");
  if (!rating || rating < 1 || rating > 5) return back("error", "Please pick a rating from 1 to 5.");

  const full_name = str(formData.get("full_name"));
  const comment = str(formData.get("comment"));
  const tooLong = validateLengths({ full_name, email, comment });
  if (tooLong) return back("error", tooLong);

  const supabase = await createClient();
  const { error } = await supabase.from("event_feedback").insert({
    event_id: eventId,
    full_name,
    email,
    rating,
    comment,
  });

  if (error) {
    if (error.code === "23505") return back("error", "You've already submitted feedback for this event.");
    if (error.code === "42501") return back("error", "Feedback isn't open for this event yet.");
    logActionError("submitFeedback", error, { eventId });
    return back("error", "Could not submit feedback. Please try again.");
  }
  return back("ok", "Thanks for your feedback!");
}
