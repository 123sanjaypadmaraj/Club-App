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

describe("announcement limits", () => {
  it("caps title at 160 and message at 2000", () => {
    expect(validateLengths({ title: "t".repeat(160), body: "b".repeat(2000) })).toBeNull();
    expect(validateLengths({ title: "t".repeat(161) })).toBe("Title is too long (max 160 characters).");
    expect(validateLengths({ body: "b".repeat(2001) })).toBe("Message is too long (max 2000 characters).");
  });
});

describe("club and event form limits", () => {
  it("matches the form maxLengths", () => {
    expect(validateLengths({ club_name: "a".repeat(80), tagline: "a".repeat(140), about: "a".repeat(2000) })).toBeNull();
    expect(validateLengths({ club_name: "a".repeat(81) })).toBe("Club name is too long (max 80 characters).");
    expect(validateLengths({ tagline: "a".repeat(141) })).toBe("Tagline is too long (max 140 characters).");
    expect(validateLengths({ venue: "a".repeat(161) })).toBe("Venue is too long (max 160 characters).");
    expect(validateLengths({ event_description: "a".repeat(4001) })).toBe("Description is too long (max 4000 characters).");
    expect(validateLengths({ faculty_advisor: "a".repeat(121) })).toBe("Faculty advisor is too long (max 120 characters).");
    expect(validateLengths({ meeting_schedule: "a".repeat(161) })).toBe("Meeting schedule is too long (max 160 characters).");
  });
});
