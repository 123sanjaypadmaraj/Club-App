import type { Registration } from "@/lib/types";

export type Bucket = { label: string; value: number };

const TZ = "Asia/Kolkata";
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const timeLabel = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });

function countBy(items: string[]): Bucket[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Registrations per calendar day (IST), in date order. */
export function registrationsByDay(regs: Pick<Registration, "registered_at">[]): Bucket[] {
  const m = new Map<string, number>();
  for (const r of regs) {
    const k = new Date(r.registered_at).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD sorts correctly
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => ({ label: dayLabel(new Date(k + "T12:00:00+05:30")), value }));
}

/** Check-ins grouped into `minutes`-wide slots, in time order; empty slots between the first and last are kept. */
export function checkinsBySlot(regs: Pick<Registration, "attended" | "attended_at">[], minutes = 15): Bucket[] {
  const ms = minutes * 60_000;
  const slots = regs.filter((r) => r.attended && r.attended_at).map((r) => Math.floor(new Date(r.attended_at!).getTime() / ms) * ms);
  if (slots.length === 0) return [];
  const counts = new Map<number, number>();
  for (const s of slots) counts.set(s, (counts.get(s) ?? 0) + 1);
  const out: Bucket[] = [];
  for (let t = Math.min(...slots); t <= Math.max(...slots); t += ms) out.push({ label: timeLabel(new Date(t)), value: counts.get(t) ?? 0 });
  return out;
}

export type Insights = {
  total: number; checkedIn: number; notArrived: number; rate: number | null;
  byDepartment: Bucket[]; byYear: Bucket[]; registrationTimeline: Bucket[]; checkinTimeline: Bucket[];
};

/** Takes the CONFIRMED registrations of one event. */
export function computeInsights(confirmed: Registration[]): Insights {
  const checkedIn = confirmed.filter((r) => r.attended).length;
  return {
    total: confirmed.length,
    checkedIn,
    notArrived: confirmed.length - checkedIn,
    rate: confirmed.length ? Math.round((checkedIn / confirmed.length) * 100) : null,
    byDepartment: countBy(confirmed.map((r) => r.department?.trim() || "Not given")),
    byYear: countBy(confirmed.map((r) => (r.year ? `Year ${r.year}` : "Not given"))).sort((a, b) => a.label.localeCompare(b.label)),
    registrationTimeline: registrationsByDay(confirmed),
    checkinTimeline: checkinsBySlot(confirmed),
  };
}
