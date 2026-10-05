import { describe, expect, it } from "vitest";
import { canRemoveFactor } from "../mfaguard";

describe("canRemoveFactor", () => {
  it("blocks removing an admin's last factor", () => {
    expect(canRemoveFactor({ role: "super_admin", verifiedCount: 1 })).toBe(false);
    expect(canRemoveFactor({ role: "super_admin", verifiedCount: 2 })).toBe(true);
  });
  it("allows it when 2FA is globally off, and for leads", () => {
    expect(canRemoveFactor({ role: "super_admin", verifiedCount: 1, adminMfaOff: true })).toBe(true);
    expect(canRemoveFactor({ role: "club_lead", verifiedCount: 1 })).toBe(true);
  });
  it("blocks when there is nothing to remove", () => expect(canRemoveFactor({ role: "club_lead", verifiedCount: 0 })).toBe(false));
});
