import { describe, expect, it } from "vitest";
import { eventToIcs, eventsToIcs, foldLine } from "@/lib/ics";

const base = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Hack, Night; 1",
  starts_at: "2026-03-05T13:00:00Z",
  ends_at: null,
  venue: "Lab 2",
  description: "Line1\nLine2",
  url: "https://x.test/events/1",
};
const now = new Date("2026-01-01T00:00:00Z");

describe("eventToIcs", () => {
  it("builds a VEVENT with UTC times, default 1h end and escaping", () => {
    const ics = eventToIcs(base, now);
    expect(ics).toContain("UID:11111111-1111-1111-1111-111111111111\r\n");
    expect(ics).toContain("DTSTART:20260305T130000Z\r\n");
    expect(ics).toContain("DTEND:20260305T140000Z\r\n");
    expect(ics).toContain("SUMMARY:Hack\\, Night\\; 1\r\n");
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2\\n\\nhttps://x.test/events/1\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("uses ends_at and omits LOCATION when no venue", () => {
    const ics = eventToIcs({ ...base, ends_at: "2026-03-05T15:30:00Z", venue: null }, now);
    expect(ics).toContain("DTEND:20260305T153000Z");
    expect(ics).not.toContain("LOCATION");
  });
});

describe("foldLine", () => {
  it("folds at 75 octets and unfolds back to the original", () => {
    const line = "DESCRIPTION:" + "é".repeat(100);
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p, i) => Buffer.byteLength(i ? p.slice(1) : p) <= (i ? 74 : 75))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
});

describe("eventsToIcs", () => {
  const mk = (id: string) => ({ id, title: `T${id}`, starts_at: "2026-11-01T10:00:00Z", ends_at: null, venue: null, description: null, url: `https://x.test/events/${id}` });
  it("emits one calendar with a name and every event", () => {
    const out = eventsToIcs([mk("a"), mk("b")], "Chess, Club", new Date("2026-10-04T00:00:00Z"));
    expect(out.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(out).toContain("X-WR-CALNAME:Chess\\, Club");
    expect(out).toContain("UID:a");
    expect(out).toContain("UID:b");
  });
  it("is a valid empty calendar with no events", () => {
    const out = eventsToIcs([], "X");
    expect(out).not.toContain("BEGIN:VEVENT");
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
