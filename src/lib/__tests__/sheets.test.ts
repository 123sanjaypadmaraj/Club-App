import { describe, expect, it } from "vitest";
import { sheetCsvUrl } from "@/lib/sheets";

describe("sheetCsvUrl", () => {
  it("converts an edit link, keeping the tab", () => {
    expect(sheetCsvUrl("https://docs.google.com/spreadsheets/d/abc_123-X/edit?usp=sharing#gid=456"))
      .toBe("https://docs.google.com/spreadsheets/d/abc_123-X/export?format=csv&gid=456");
  });
  it("converts a published link", () => {
    expect(sheetCsvUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1v/pubhtml"))
      .toBe("https://docs.google.com/spreadsheets/d/e/2PACX-1v/pub?output=csv");
  });
  it("rejects other hosts and non-sheet links", () => {
    expect(sheetCsvUrl("https://evil.example/spreadsheets/d/abc/edit")).toBeNull();
    expect(sheetCsvUrl("https://docs.google.com/forms/d/abc/edit")).toBeNull();
    expect(sheetCsvUrl("http://docs.google.com/spreadsheets/d/abc/edit")).toBeNull();
    expect(sheetCsvUrl(null)).toBeNull();
  });
});

import { isGoogleHost, readCapped } from "../sheets";
describe("isGoogleHost", () => {
  it("allows Google hosts only", () => {
    for (const h of ["docs.google.com", "doc-0s-abc.googleusercontent.com", "accounts.google.com"]) expect(isGoogleHost(h), h).toBe(true);
    for (const h of ["evil.com", "google.com.evil.com", "169.254.169.254", "localhost", "notgoogle.com"]) expect(isGoogleHost(h), h).toBe(false);
  });
});
describe("readCapped", () => {
  it("returns the text when under the cap", async () => expect(await readCapped(new Response("a,b\n1,2"), 100)).toBe("a,b\n1,2"));
  it("returns null when over the cap", async () => expect(await readCapped(new Response("x".repeat(500)), 100)).toBeNull());
});
