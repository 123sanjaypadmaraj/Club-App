import { describe, expect, it } from "vitest";
import { mustChangePassword } from "../session";

const flagged = { app_metadata: { must_change_password: true } };

describe("mustChangePassword", () => {
  it("redirects flagged users away from other dashboard pages", () => {
    expect(mustChangePassword(flagged, "/dashboard")).toBe(true);
    expect(mustChangePassword(flagged, "/dashboard/clubs/robotics/events")).toBe(true);
  });
  it("leaves the account page reachable", () => {
    expect(mustChangePassword(flagged, "/dashboard/account")).toBe(false);
    expect(mustChangePassword(flagged, "/dashboard/account/")).toBe(false);
  });
  it("does not match look-alike paths", () => {
    expect(mustChangePassword(flagged, "/dashboard/accountant")).toBe(true);
  });
  it("ignores unflagged users, missing users and non-dashboard paths", () => {
    expect(mustChangePassword({ app_metadata: {} }, "/dashboard")).toBe(false);
    expect(mustChangePassword({ app_metadata: { must_change_password: "true" } }, "/dashboard")).toBe(false);
    expect(mustChangePassword(null, "/dashboard")).toBe(false);
    expect(mustChangePassword(flagged, "/login")).toBe(false);
  });
  it("only redirects page loads, so server actions such as sign-out still work", () => {
    expect(mustChangePassword(flagged, "/dashboard/clubs", "POST")).toBe(false);
    expect(mustChangePassword(flagged, "/dashboard/clubs", "HEAD")).toBe(true);
  });
});
