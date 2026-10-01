"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { int, str } from "@/lib/format";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public: register for an event. RLS enforces published / open / capacity. */
export async function registerForEvent(eventId: string, formData: FormData) {
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}?${k}=${encodeURIComponent(msg)}`);

  const full_name = str(formData.get("full_name"));
  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  if (!full_name || !email) return back("error", "Name and email are required.");
  if (!EMAIL.test(email)) return back("error", "Please enter a valid email address.");

  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    full_name,
    email,
    roll_no: str(formData.get("roll_no")),
    department: str(formData.get("department")),
    year: int(formData.get("year")),
    phone: str(formData.get("phone")),
  });

  if (error) {
    if (error.code === "23505") return back("error", "You are already registered for this event.");
    if (error.code === "42501") return back("error", "Registration is closed or the event is full.");
    return back("error", "Could not register. Please try again.");
  }
  return back("ok", "You're registered! See you there.");
}

/** Public: submit feedback for an event that has started. */
export async function submitFeedback(eventId: string, formData: FormData) {
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}/feedback?${k}=${encodeURIComponent(msg)}`);

  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  const rating = int(formData.get("rating"));
  if (!email || !EMAIL.test(email)) return back("error", "Please enter a valid email address.");
  if (!rating || rating < 1 || rating > 5) return back("error", "Please pick a rating from 1 to 5.");

  const supabase = await createClient();
  const { error } = await supabase.from("event_feedback").insert({
    event_id: eventId,
    full_name: str(formData.get("full_name")),
    email,
    rating,
    comment: str(formData.get("comment")),
  });

  if (error) {
    if (error.code === "23505") return back("error", "You've already submitted feedback for this event.");
    if (error.code === "42501") return back("error", "Feedback isn't open for this event yet.");
    return back("error", "Could not submit feedback. Please try again.");
  }
  return back("ok", "Thanks for your feedback!");
}
