import { describe, expect, it } from "vitest";
import { EVENT_CATEGORIES, pickFilter } from "@/lib/categories";

describe("pickFilter", () => {
  it("accepts allowed values, including the first of an array", () => {
    expect(pickFilter("Talk", EVENT_CATEGORIES)).toBe("Talk");
    expect(pickFilter(["Social", "Talk"], EVENT_CATEGORIES)).toBe("Social");
  });
  it("ignores unknown or missing values", () => {
    expect(pickFilter("Nope", EVENT_CATEGORIES)).toBe("");
    expect(pickFilter(undefined, EVENT_CATEGORIES)).toBe("");
    expect(pickFilter("", EVENT_CATEGORIES)).toBe("");
  });
});
