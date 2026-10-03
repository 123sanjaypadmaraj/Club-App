import { describe, expect, it } from "vitest";
import { loginRedirectTarget, safeNextPath } from "../redirect";

const B = String.fromCharCode(92);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

describe("safeNextPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeNextPath("/dashboard/clubs/chess?ok=1")).toBe("/dashboard/clubs/chess?ok=1");
    expect(safeNextPath("/")).toBe("/");
  });
  it("falls back for missing, absolute and protocol-relative targets", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("evil.com")).toBe("/dashboard");
  });
  it("rejects backslash and control-character tricks", () => {
    expect(safeNextPath("/" + B + "evil.com")).toBe("/dashboard");
    expect(safeNextPath("/a" + B + "b")).toBe("/dashboard");
    expect(safeNextPath("/" + TAB + "/evil.com")).toBe("/dashboard");
    expect(safeNextPath("/" + LF + "/evil.com")).toBe("/dashboard");
  });
  it("honours a custom fallback", () => {
    expect(safeNextPath("//x", "/home")).toBe("/home");
  });
});

describe("loginRedirectTarget", () => {
  it("returns the bare path when there is no query", () => {
    expect(loginRedirectTarget("/dashboard", "")).toBe("/dashboard");
    expect(loginRedirectTarget("/dashboard", "?")).toBe("/dashboard");
  });
  it("keeps the query string", () => {
    expect(loginRedirectTarget("/dashboard/clubs/x/members", "?q=riya&status=alumni")).toBe("/dashboard/clubs/x/members?q=riya&status=alumni");
  });
  it("keeps an encoded ampersand intact and survives safeNextPath", () => {
    const t = loginRedirectTarget("/dashboard/export/feedback", "?club=a%26b");
    expect(t).toBe("/dashboard/export/feedback?club=a%26b");
    expect(safeNextPath(t)).toBe(t);
  });
});
