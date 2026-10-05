import { describe, expect, it } from "vitest";
import { isEmail, MAX_IMPORT_BYTES } from "../email";

describe("isEmail", () => {
  it("accepts normal addresses", () => {
    for (const e of ["a@b.co", "first.last+tag@sub.example.org"]) expect(isEmail(e), e).toBe(true);
  });
  it("rejects malformed and non-strings", () => {
    for (const e of ["", "a@b", "a b@c.d", "@b.c", "a@@b.c", "a@b.", "a@.b.c", null, 5]) expect(isEmail(e as never), String(e)).toBe(false);
  });
  it("rejects over-long input immediately and fast", () => {
    const evil = "a@" + "b".repeat(1_000_000);
    const t = Date.now();
    expect(isEmail(evil)).toBe(false);
    expect(isEmail("a@" + "b.".repeat(100_000))).toBe(false);
    expect(Date.now() - t).toBeLessThan(200);
  });
  it("exposes an import size cap", () => expect(MAX_IMPORT_BYTES).toBe(1_000_000));
});
