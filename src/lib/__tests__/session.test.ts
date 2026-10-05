import { describe, expect, it } from "vitest";
import { parseLastSeen, sessionExpiry, sessionLimits } from "../session";

const base = { now: 10_000_000, idleMs: 1000, absoluteMs: 5000 };
describe("sessionExpiry", () => {
  it("ok when recent", () => expect(sessionExpiry({ ...base, signedInAt: 9_999_000, lastSeen: 9_999_500 })).toBe("ok"));
  it("idle", () => expect(sessionExpiry({ ...base, signedInAt: 9_999_000, lastSeen: 9_998_000 })).toBe("idle"));
  it("absolute wins over idle", () => expect(sessionExpiry({ ...base, signedInAt: 9_990_000, lastSeen: 9_998_000 })).toBe("absolute"));
  it("missing cookie counts as now", () => expect(sessionExpiry({ ...base, signedInAt: 9_999_000, lastSeen: null })).toBe("ok"));
  it("boundaries are inclusive-ok", () => {
    expect(sessionExpiry({ ...base, signedInAt: 9_995_000, lastSeen: 9_999_000 })).toBe("ok");
    expect(sessionExpiry({ ...base, signedInAt: 9_994_999, lastSeen: 9_999_000 })).toBe("absolute");
  });
});
describe("parseLastSeen / sessionLimits", () => {
  it("rejects junk", () => {
    expect(parseLastSeen("abc")).toBeNull();
    expect(parseLastSeen(undefined)).toBeNull();
    expect(parseLastSeen("1700000000000")).toBe(1700000000000);
  });
  it("defaults and overrides", () => {
    expect(sessionLimits({})).toEqual({ idleMs: 3_600_000, absoluteMs: 43_200_000 });
    expect(sessionLimits({ SESSION_IDLE_MINUTES: "5", SESSION_MAX_HOURS: "x" })).toEqual({ idleMs: 300_000, absoluteMs: 43_200_000 });
  });
});
