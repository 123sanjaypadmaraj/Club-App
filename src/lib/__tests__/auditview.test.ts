import { describe, expect, it } from "vitest";
import { formatDetail, isUuid, parseBefore } from "../auditview";

describe("parseBefore", () => {
  it("accepts positive integers only", () => {
    expect(parseBefore("42")).toBe(42);
    for (const bad of ["0", "-1", "1.5", "abc", "", "1e3", undefined, ["1"]]) expect(parseBefore(bad as never)).toBeNull();
  });
});
describe("formatDetail", () => {
  it("joins key=value and handles non-objects", () => {
    expect(formatDetail({ a: 1, b: "x", c: { d: 1 } })).toBe('a=1 b=x c={"d":1}');
    expect(formatDetail(null)).toBe("");
    expect(formatDetail([1])).toBe("");
  });
  it("truncates", () => expect(formatDetail({ a: "x".repeat(1000) }).length).toBe(300));
});
describe("isUuid", () => {
  it("checks shape", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("nope")).toBe(false);
  });
});
