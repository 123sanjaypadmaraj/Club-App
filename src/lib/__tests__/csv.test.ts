import { describe, expect, it } from "vitest";
import { csvResponse, parseCsv, toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes fields with commas, quotes and newlines", () => {
    const out = toCsv([{ a: 'x,"y"', b: "l1\nl2" }]);
    expect(out).toBe('a,b\r\n"x,""y""","l1\nl2"');
  });
  it("prefixes formula-like values", () => {
    expect(toCsv([{ a: "=SUM(A1)", b: "+1", c: "-1", d: "@x" }])).toBe("a,b,c,d\r\n'=SUM(A1),'+1,'-1,'@x");
  });
  it("renders null as empty and honours column order", () => {
    expect(toCsv([{ a: null, b: 2 }], ["b", "a"])).toBe("b,a\r\n2,");
  });
});

describe("csvResponse", () => {
  it("adds a BOM and sanitises the filename", async () => {
    const res = csvResponse("my file?.csv", "a");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // text() would strip the BOM
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="my_file_.csv"');
  });
});

describe("parseCsv", () => {
  it("handles quoted commas and escaped quotes", () => {
    expect(parseCsv('"Shah, Riya",r@x.com\n"a ""b""",c')).toEqual([
      ["Shah, Riya", "r@x.com"],
      ['a "b"', "c"],
    ]);
  });
  it("handles CRLF, blank lines and no trailing newline", () => {
    expect(parseCsv("a,b\r\n\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("keeps newlines inside quotes and empty fields", () => {
    expect(parseCsv('"a\nb",,c\n')).toEqual([["a\nb", "", "c"]]);
  });
});
