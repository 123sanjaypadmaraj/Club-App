import { describe, expect, it } from "vitest";
import { safeNextPath } from "../redirect";

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
