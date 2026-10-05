import { describe, expect, it } from "vitest";
import { securityTxt } from "../securitytxt";

const now = new Date("2026-01-01T00:00:00Z");
describe("securityTxt", () => {
  it("is null without a valid contact", () => {
    expect(securityTxt({ contact: undefined, siteUrl: undefined, now })).toBeNull();
    expect(securityTxt({ contact: "javascript:alert(1)", siteUrl: undefined, now })).toBeNull();
  });
  it("builds the file with expiry 180 days out", () => {
    const t = securityTxt({ contact: "mailto:sec@example.com", siteUrl: "https://x.test/", now })!;
    expect(t).toContain("Contact: mailto:sec@example.com");
    expect(t).toContain("Expires: 2026-06-30T00:00:00.000Z");
    expect(t).toContain("Canonical: https://x.test/.well-known/security.txt");
  });
});
