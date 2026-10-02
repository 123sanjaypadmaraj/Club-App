import { describe, expect, it } from "vitest";
import { checkinsBySlot, computeInsights, registrationsByDay } from "@/lib/insights";
import type { Registration } from "@/lib/types";

const r = (o: Partial<Registration>) =>
  ({ id: "x", attended: false, attended_at: null, department: null, year: null, registered_at: "2026-03-01T05:00:00Z", ...o }) as Registration;

describe("insights", () => {
  it("buckets check-ins into 15-minute slots and keeps empty slots", () => {
    const out = checkinsBySlot([
      r({ attended: true, attended_at: "2026-03-01T04:31:00Z" }),
      r({ attended: true, attended_at: "2026-03-01T04:44:00Z" }),
      r({ attended: true, attended_at: "2026-03-01T05:20:00Z" }),
      r({ attended: false }),
    ]);
    expect(out.map((b) => b.value)).toEqual([2, 0, 0, 1]);
  });
  it("returns nothing when no one has checked in", () => {
    expect(checkinsBySlot([r({})])).toEqual([]);
  });
  it("groups registrations by IST day in order", () => {
    const out = registrationsByDay([
      r({ registered_at: "2026-03-02T10:00:00Z" }),
      r({ registered_at: "2026-03-01T10:00:00Z" }),
      r({ registered_at: "2026-03-01T11:00:00Z" }),
    ]);
    expect(out.map((b) => b.value)).toEqual([2, 1]);
  });
  it("computes totals, rate and breakdowns", () => {
    const i = computeInsights([
      r({ attended: true, attended_at: "2026-03-01T05:00:00Z", department: "CSE", year: 2 }),
      r({ department: "CSE", year: 1 }),
      r({ department: "ECE" }),
      r({ department: "CSE", year: 2 }),
    ]);
    expect(i).toMatchObject({ total: 4, checkedIn: 1, notArrived: 3, rate: 25 });
    expect(i.byDepartment[0]).toEqual({ label: "CSE", value: 3 });
    expect(i.byYear.map((b) => b.label)).toEqual(["Not given", "Year 1", "Year 2"]);
  });
  it("handles an empty list", () => {
    expect(computeInsights([])).toMatchObject({ total: 0, rate: null });
  });
});
