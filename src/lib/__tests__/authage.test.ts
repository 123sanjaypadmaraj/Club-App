import { describe, expect, it } from "vitest";
import { authAgeSeconds } from "../authage";

describe("authAgeSeconds", () => {
  const now = 1_000_000 * 1000;
  it("is Infinity with no methods", () => {
    expect(authAgeSeconds([], now)).toBe(Infinity);
    expect(authAgeSeconds(null, now)).toBe(Infinity);
  });
  it("uses the newest method", () => {
    expect(authAgeSeconds([{ timestamp: 999_000 }, { timestamp: 999_900 }], now)).toBe(100);
  });
  it("never goes negative", () => {
    expect(authAgeSeconds([{ timestamp: 1_000_500 }], now)).toBe(0);
  });
});
