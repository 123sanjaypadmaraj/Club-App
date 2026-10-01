import type { ClubEvent } from "@/lib/types";

const WEEK_MS = 7 * 24 * 3600_000;
const shift = (iso: string) => new Date(new Date(iso).getTime() + WEEK_MS).toISOString();

/** Fields for a draft copy of an event, moved one week later. Registrations and feedback are not copied. */
export function duplicateEventRow(e: ClubEvent) {
  return {
    club_id: e.club_id,
    title: `${e.title} (copy)`,
    description: e.description,
    category: e.category,
    venue: e.venue,
    starts_at: shift(e.starts_at),
    ends_at: e.ends_at ? shift(e.ends_at) : null,
    capacity: e.capacity,
    registration_url: e.registration_url,
    feedback_url: e.feedback_url,
    registration_open: true,
    status: "draft" as const,
    budget_allocated: 0,
    budget_spent: 0,
  };
}

/** Link-preview text: "<when> · <venue> — <first ~150 chars of description>". Parts that are missing are skipped. */
export function eventShareDescription(when: string, venue: string | null, description: string | null, max = 150): string {
  const head = [when, venue].filter(Boolean).join(" · ");
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  const body = text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  return [head, body].filter(Boolean).join(" — ");
}
