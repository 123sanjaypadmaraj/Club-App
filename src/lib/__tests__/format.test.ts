import { describe, expect, it } from "vitest";
import { fromLocalInput, int, safeUrl, str, toLocalInput } from "@/lib/format";

describe("local input conversion (IST)", () => {
  it("round-trips", () => {
    expect(toLocalInput(fromLocalInput("2026-03-05T18:30"))).toBe("2026-03-05T18:30");
  });
  it("interprets input as +05:30", () => {
    expect(fromLocalInput("2026-03-05T18:30")).toBe("2026-03-05T13:00:00.000Z");
  });
  it("handles empty values", () => {
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });
});

describe("safeUrl", () => {
  it("adds https and accepts http(s)", () => {
    expect(safeUrl("example.com")).toBe("https://example.com/");
    expect(safeUrl("http://a.io/x")).toBe("http://a.io/x");
  });
  it("rejects other schemes and blanks", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("  ")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("str / int", () => {
  it("trims and nulls", () => {
    expect(str("  hi ")).toBe("hi");
    expect(str("   ")).toBeNull();
    expect(int("12abc")).toBe(12);
    expect(int("x")).toBeNull();
  });
});
