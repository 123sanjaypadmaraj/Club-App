import { describe, expect, it } from "vitest";
import { safeColor, safeHref } from "../safe";

describe("safeColor", () => {
  it("keeps valid hex and rejects CSS injection", () => {
    expect(safeColor("#a1B2c3")).toBe("#a1B2c3");
    for (const bad of ["red", "#fff", "#12345g", "#ffffff; background:url(x)", "url(x)", null, undefined, 5]) expect(safeColor(bad), String(bad)).toBe("#4f46e5");
    expect(safeColor("x", "#000000")).toBe("#000000");
  });
});
describe("safeHref", () => {
  it("allows http(s) only", () => {
    expect(safeHref("https://a.example/x?y=1")).toBe("https://a.example/x?y=1");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a", "//a.b", "not a url", "", null, undefined]) expect(safeHref(bad as never), String(bad)).toBeUndefined();
  });
  it("rejects absurdly long values", () => expect(safeHref("https://a.example/" + "x".repeat(3000))).toBeUndefined());
});
