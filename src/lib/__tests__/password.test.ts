import { describe, expect, it } from "vitest";
import { validatePasswordChange, weakPasswordReason } from "@/lib/password";

describe("weakPasswordReason", () => {
  it("accepts a long, varied password", () => {
    expect(weakPasswordReason("river-lantern-47-quartz")).toBeNull();
  });
  it("rejects short, common, repeated and identity-based passwords", () => {
    expect(weakPasswordReason("short1")).toMatch(/12 characters/);
    expect(weakPasswordReason("MyPassword12345")).toMatch(/easy to guess/);
    expect(weakPasswordReason("aaaaaaaaaaaaaa")).toMatch(/easy to guess/);
    expect(weakPasswordReason("robotics-club-2026x", "robotics@college.edu")).toMatch(/username or email/);
    expect(weakPasswordReason("abababababab9")).toMatch(/variety/);
  });
});

describe("validatePasswordChange", () => {
  it("accepts a valid change", () => {
    expect(validatePasswordChange("oldpassword", "river-lantern-47-quartz", "river-lantern-47-quartz")).toBeNull();
  });
  it("rejects each bad case", () => {
    expect(validatePasswordChange("", "river-lantern-47-quartz", "river-lantern-47-quartz")).toMatch(/current/);
    expect(validatePasswordChange("old", "short", "short")).toMatch(/12 characters/);
    expect(validatePasswordChange("old", "river-lantern-47-quartz", "different-lantern-47")).toMatch(/match/);
    expect(validatePasswordChange("river-lantern-47-quartz", "river-lantern-47-quartz", "river-lantern-47-quartz")).toMatch(/different/);
  });
});
