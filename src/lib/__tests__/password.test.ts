import { describe, expect, it } from "vitest";
import { validatePasswordChange } from "@/lib/password";

describe("validatePasswordChange", () => {
  it("accepts a valid change", () => {
    expect(validatePasswordChange("oldpassword", "newpassword1", "newpassword1")).toBeNull();
  });
  it("rejects each bad case", () => {
    expect(validatePasswordChange("", "newpassword1", "newpassword1")).toMatch(/current/);
    expect(validatePasswordChange("old", "short", "short")).toMatch(/8 characters/);
    expect(validatePasswordChange("old", "newpassword1", "different1")).toMatch(/match/);
    expect(validatePasswordChange("samepassword", "samepassword", "samepassword")).toMatch(/different/);
  });
});
