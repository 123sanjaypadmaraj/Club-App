import { describe, expect, it } from "vitest";
import { duplicateEventRow, eventShareDescription } from "@/lib/events";
import type { ClubEvent } from "@/lib/types";

const ev: ClubEvent = {
  id: "e1", club_id: "c1", title: "Weekly Meetup", description: "d", category: "Meeting", venue: "Hall",
  starts_at: "2026-03-05T13:00:00.000Z", ends_at: "2026-03-05T15:00:00.000Z", capacity: 40,
  registration_url: "https://r.test", feedback_url: null, poster_url: null, registration_open: false,
  status: "published", budget_allocated: 500, budget_spent: 300,
};

describe("duplicateEventRow", () => {
  it("makes a draft copy a week later with registration reopened", () => {
    const d = duplicateEventRow(ev);
    expect(d.title).toBe("Weekly Meetup (copy)");
    expect(d.starts_at).toBe("2026-03-12T13:00:00.000Z");
    expect(d.ends_at).toBe("2026-03-12T15:00:00.000Z");
    expect(d.status).toBe("draft");
    expect(d.registration_open).toBe(true);
    expect(d.capacity).toBe(40);
    expect(d).not.toHaveProperty("id");
  });
  it("keeps a missing end time null and resets budget spend", () => {
    const d = duplicateEventRow({ ...ev, ends_at: null });
    expect(d.ends_at).toBeNull();
    expect(d.budget_spent).toBe(0);
  });
});

describe("eventShareDescription", () => {
  it("joins when, venue and description", () => {
    expect(eventShareDescription("5 Mar, 6:30 pm", "Hall", "Come along")).toBe("5 Mar, 6:30 pm · Hall — Come along");
  });
  it("skips missing parts and truncates long text", () => {
    expect(eventShareDescription("5 Mar", null, null)).toBe("5 Mar");
    const out = eventShareDescription("w", null, "x".repeat(400), 150);
    expect(out.length).toBeLessThanOrEqual(1 + 3 + 150);
    expect(out.endsWith("…")).toBe(true);
  });
});
