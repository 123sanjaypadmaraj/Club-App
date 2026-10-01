import type { EventStat } from "@/lib/types";

export type Range = "3" | "6" | "12" | "all";
export const RANGES: { value: Range; label: string }[] = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "all", label: "All time" },
];

export function parseRange(v: string | string[] | undefined): Range {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "3" || s === "6" || s === "12" || s === "all" ? s : "12";
}

export function rangeStart(range: Range): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (Number(range) - 1));
  return d;
}

/** Events that count toward metrics: not cancelled/draft, and inside the date range. */
export function inRange(stats: EventStat[], range: Range): EventStat[] {
  const start = rangeStart(range);
  return stats.filter((s) => s.status === "published" && (!start || new Date(s.starts_at) >= start));
}

export type Totals = {
  events: number;
  pastEvents: number;
  registrations: number;
  attendees: number;
  attendanceRate: number | null; // % of registrations that showed up, past events only
  avgRating: number | null; // weighted by number of responses
  feedbackCount: number;
  budgetAllocated: number;
  budgetSpent: number;
};

export function totals(stats: EventStat[]): Totals {
  const now = Date.now();
  let pastRegs = 0, pastAtt = 0, ratingSum = 0, feedbackCount = 0, registrations = 0, attendees = 0, pastEvents = 0, ba = 0, bs = 0;
  for (const s of stats) {
    registrations += s.registrations;
    attendees += s.attendees;
    ba += Number(s.budget_allocated);
    bs += Number(s.budget_spent);
    if (new Date(s.starts_at).getTime() <= now) {
      pastEvents++;
      pastRegs += s.registrations;
      pastAtt += s.attendees;
    }
    if (s.avg_rating != null && s.feedback_count > 0) {
      ratingSum += Number(s.avg_rating) * s.feedback_count;
      feedbackCount += s.feedback_count;
    }
  }
  return {
    events: stats.length,
    pastEvents,
    registrations,
    attendees,
    attendanceRate: pastRegs > 0 ? Math.round((pastAtt / pastRegs) * 100) : null,
    avgRating: feedbackCount > 0 ? Math.round((ratingSum / feedbackCount) * 100) / 100 : null,
    feedbackCount,
    budgetAllocated: ba,
    budgetSpent: bs,
  };
}

export type MonthPoint = { key: string; label: string; events: number; registrations: number; attendees: number; avgRating: number | null };

/** One point per calendar month (gaps filled with zeros). */
export function monthly(stats: EventStat[], range: Range): MonthPoint[] {
  if (stats.length === 0 && range === "all") return [];
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const start = rangeStart(range) ?? new Date(Math.min(...stats.map((s) => new Date(s.starts_at).getTime())));
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date();
  const buckets = new Map<string, EventStat[]>();
  for (const s of stats) {
    const k = keyOf(new Date(s.starts_at));
    buckets.set(k, [...(buckets.get(k) ?? []), s]);
  }
  const out: MonthPoint[] = [];
  while (cursor <= end) {
    const k = keyOf(cursor);
    const t = totals(buckets.get(k) ?? []);
    out.push({
      key: k,
      label: cursor.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      events: t.events,
      registrations: t.registrations,
      attendees: t.attendees,
      avgRating: t.avgRating,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

/** Percentage change between the last two non-empty halves — a simple "trend vs previous period". */
export function trend(points: MonthPoint[], field: "registrations" | "events" | "attendees"): number | null {
  if (points.length < 2) return null;
  const half = Math.floor(points.length / 2);
  const prev = points.slice(0, half).reduce((a, p) => a + p[field], 0);
  const curr = points.slice(half).reduce((a, p) => a + p[field], 0);
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}
