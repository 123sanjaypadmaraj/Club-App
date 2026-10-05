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
