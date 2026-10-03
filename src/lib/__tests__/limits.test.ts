import { describe, expect, it } from "vitest";
import { LIMITS, validateLengths } from "../limits";

describe("validateLengths", () => {
  it("accepts values at the limit and missing values", () => {
    expect(validateLengths({ full_name: "a".repeat(LIMITS.full_name), email: null, phone: undefined })).toBeNull();
    expect(validateLengths({})).toBeNull();
  });
  it("reports the first over-long field with its limit", () => {
    expect(validateLengths({ full_name: "a".repeat(121) })).toBe("Name is too long (max 120 characters).");
    expect(validateLengths({ comment: "x".repeat(2001) })).toBe("Comments is too long (max 2000 characters).");
  });
  it("checks every limited field", () => {
    for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      expect(validateLengths({ [k]: "z".repeat(LIMITS[k] + 1) })).not.toBeNull();
    }
  });
});
