/**
 * Explicit event column lists. After supabase/security.sql section 7 runs, the database refuses `select *` on events
 * for signed-out visitors (and hides the responses-sheet link from everyone but a club's managers), so queries must name columns.
 */
export const PUBLIC_EVENT_COLUMNS =
  "id, club_id, title, description, category, venue, starts_at, ends_at, capacity, registration_url, feedback_url, poster_url, registration_open, status, created_at";

/** Signed-in club managers also read the budget fields (the responses-sheet link comes from the event_responses_sheet function). */
export const LEAD_EVENT_COLUMNS = `${PUBLIC_EVENT_COLUMNS}, budget_allocated, budget_spent`;
