import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inRange, monthly, parseRange, totals, trend } from "@/lib/stats";
import type { EventStat } from "@/lib/types";

const ev = (o: Partial<EventStat>): EventStat => ({
  event_id: "e", club_id: "c", title: "t", category: "x", status: "published",
  starts_at: "2026-05-10T10:00:00Z", capacity: null, budget_allocated: 0, budget_spent: 0,
  registrations: 0, attendees: 0, feedback_count: 0, avg_rating: null, ...o,
});

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 15, 12)); }); // 15 Jun 2026 local
afterEach(() => vi.useRealTimers());

describe("parseRange", () => {
  it("accepts known values and defaults to 12", () => {
    expect(parseRange("3")).toBe("3");
    expect(parseRange(["all", "3"])).toBe("all");
    expect(parseRange("99")).toBe("12");
    expect(parseRange(undefined)).toBe("12");
  });
});

describe("inRange", () => {
  it("drops draft/cancelled and out-of-range events", () => {
    const stats = [
      ev({ event_id: "ok", starts_at: new Date(2026, 4, 1).toISOString() }),
      ev({ event_id: "draft", status: "draft" }),
      ev({ event_id: "cancelled", status: "cancelled" }),
      ev({ event_id: "old", starts_at: new Date(2025, 0, 1).toISOString() }),
    ];
    expect(inRange(stats, "3").map((s) => s.event_id)).toEqual(["ok"]);
    expect(inRange(stats, "all").map((s) => s.event_id)).toEqual(["ok", "old"]);
  });
});

describe("totals", () => {
  it("computes attendance over past events only and weights rating", () => {
    const t = totals([
      ev({ registrations: 10, attendees: 5, feedback_count: 1, avg_rating: 5 }),
      ev({ registrations: 10, attendees: 10, feedback_count: 3, avg_rating: 3 }),
      ev({ starts_at: "2027-01-01T00:00:00Z", registrations: 50, attendees: 0 }),
    ]);
    expect(t.pastEvents).toBe(2);
    expect(t.registrations).toBe(70);
    expect(t.attendanceRate).toBe(75);
    expect(t.avgRating).toBe(3.5);
  });
  it("returns nulls for empty input", () => {
    const t = totals([]);
    expect(t.attendanceRate).toBeNull();
    expect(t.avgRating).toBeNull();
  });
});

describe("monthly", () => {
  it("fills gaps with zeros", () => {
    const pts = monthly([ev({ starts_at: new Date(2026, 3, 10).toISOString(), registrations: 4 })], "3");
    expect(pts.map((p) => p.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(pts.map((p) => p.registrations)).toEqual([4, 0, 0]);
  });
  it("returns nothing for empty all-time data", () => {
    expect(monthly([], "all")).toEqual([]);
  });
});

describe("trend", () => {
  const pt = (registrations: number) => ({ key: "", label: "", events: 0, registrations, attendees: 0, avgRating: null });
  it("compares halves", () => {
    expect(trend([pt(10), pt(10), pt(15), pt(15)], "registrations")).toBe(50);
  });
  it("handles prev=0 and short series", () => {
    expect(trend([pt(0), pt(5)], "registrations")).toBe(100);
    expect(trend([pt(0), pt(0)], "registrations")).toBeNull();
    expect(trend([pt(1)], "registrations")).toBeNull();
  });
});
