"use server";

import { flashQuery } from "@/lib/flash";
import { isEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { logActionError } from "@/lib/log";
import { validateLengths } from "@/lib/limits";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { int, str } from "@/lib/format";
import { newTicketCode } from "@/lib/tickets";
import { clientIp, LIMITS_POLICY, rateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";


/** Public: register for an event. RLS enforces published / open / capacity. */
export async function registerForEvent(eventId: string, formData: FormData) {
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}?${flashQuery(k, msg)}`);

  const ip = await clientIp();
  if (!(await rateLimit("register", ip, LIMITS_POLICY.register.max, LIMITS_POLICY.register.window))) return back("error", "Too many attempts. Please wait a while and try again.");
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip, "register"))) return back("error", "Please complete the verification and try again.");

  const full_name = str(formData.get("full_name"));
  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  if (!full_name || !email) return back("error", "Name and email are required.");
  if (!isEmail(email)) return back("error", "Please enter a valid email address.");
  const roll_no = str(formData.get("roll_no"));
  const department = str(formData.get("department"));
  const phone = str(formData.get("phone"));
  const tooLong = validateLengths({ full_name, email, roll_no, department, phone });
  if (tooLong) return back("error", tooLong);

  // The code is made here (anonymous visitors can't read their row back) and the DB decides
  // confirmed vs. waitlisted. The ticket page looks it up through a security-definer function.
  const ticket_code = newTicketCode();
  const row = { event_id: eventId, full_name, email, roll_no, department, year: int(formData.get("year")), phone, ticket_code };
  // Preferred path: a server-only database function, so the public API key cannot insert around CAPTCHA and rate limits.
  let { error } = await createServiceClient().rpc("submit_registration", {
    p_event: eventId, p_full_name: full_name, p_email: email, p_roll_no: roll_no, p_department: department, p_year: row.year, p_phone: phone, p_ticket_code: ticket_code,
  });
  if (error?.code === "PGRST202") {
    // supabase/security.sql not re-run yet: fall back to the old policy-guarded insert
    ({ error } = await (await createClient()).from("event_registrations").insert(row));
  }

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
  const back = (k: "ok" | "error", msg: string): never => redirect(`/events/${eventId}/feedback?${flashQuery(k, msg)}`);

  const ip = await clientIp();
  if (!(await rateLimit("feedback", ip, LIMITS_POLICY.feedback.max, LIMITS_POLICY.feedback.window))) return back("error", "Too many attempts. Please wait a while and try again.");
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"), ip, "feedback"))) return back("error", "Please complete the verification and try again.");

  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  const rating = int(formData.get("rating"));
  if (!email || !isEmail(email)) return back("error", "Please enter a valid email address.");
  if (!rating || rating < 1 || rating > 5) return back("error", "Please pick a rating from 1 to 5.");

  const full_name = str(formData.get("full_name"));
  const comment = str(formData.get("comment"));
  const tooLong = validateLengths({ full_name, email, comment });
  if (tooLong) return back("error", tooLong);

  let { error } = await createServiceClient().rpc("submit_feedback", { p_event: eventId, p_full_name: full_name, p_email: email, p_rating: rating, p_comment: comment });
  if (error?.code === "PGRST202") {
    ({ error } = await (await createClient()).from("event_feedback").insert({ event_id: eventId, full_name, email, rating, comment }));
  }

  if (error) {
    if (error.code === "23505") return back("error", "You've already submitted feedback for this event.");
    if (error.code === "42501") return back("error", "Feedback isn't open for this event yet.");
    logActionError("submitFeedback", error, { eventId });
    return back("error", "Could not submit feedback. Please try again.");
  }
  return back("ok", "Thanks for your feedback!");
}
