import { describe, expect, it } from "vitest";
import { filterRegistrations } from "@/lib/participants";
import type { Registration } from "@/lib/types";

const r = (o: Partial<Registration>) => ({ id: "x", full_name: "", email: "", roll_no: null, ...o }) as Registration;
const regs = [
  r({ id: "1", full_name: "Riya Shah", email: "riya@college.edu", roll_no: "21CS001" }),
  r({ id: "2", full_name: "Arjun Rao", email: "arjun@college.edu", roll_no: null }),
];

describe("filterRegistrations", () => {
  it("returns all for an empty or blank query", () => {
    expect(filterRegistrations(regs, "")).toHaveLength(2);
    expect(filterRegistrations(regs, "   ")).toHaveLength(2);
  });
  it("matches name, email and roll no case-insensitively", () => {
    expect(filterRegistrations(regs, "SHAH").map((x) => x.id)).toEqual(["1"]);
    expect(filterRegistrations(regs, "arjun@").map((x) => x.id)).toEqual(["2"]);
    expect(filterRegistrations(regs, "21cs").map((x) => x.id)).toEqual(["1"]);
  });
  it("returns nothing when no match and tolerates null roll no", () => {
    expect(filterRegistrations(regs, "zzz")).toEqual([]);
  });
});

import { displayEmail, parseParticipantRows, placeholderEmail, sortRegistrations } from "@/lib/participants";

describe("filterRegistrations (phone / ticket)", () => {
  it("also matches phone and ticket code", () => {
    const list = [r({ id: "1", phone: "98765 43210", ticket_code: "ABCD234567" }), r({ id: "2", phone: null, ticket_code: "ZZZZ222222" })];
    expect(filterRegistrations(list, "98765").map((x) => x.id)).toEqual(["1"]);
    expect(filterRegistrations(list, "zzzz2").map((x) => x.id)).toEqual(["2"]);
  });
});

describe("sortRegistrations", () => {
  const list = [
    r({ id: "a", full_name: "Zed", year: 2, department: "CSE", registered_at: "2026-01-02", attended: true }),
    r({ id: "b", full_name: "amy", year: null, department: "ECE", registered_at: "2026-01-01", attended: false }),
    r({ id: "c", full_name: "Bob", year: 1, department: "CSE", registered_at: "2026-01-03", attended: false }),
  ];
  it("sorts by name case-insensitively, either direction", () => {
    expect(sortRegistrations(list, "name").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(sortRegistrations(list, "name", "desc").map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
  it("puts missing years last and does not mutate", () => {
    expect(sortRegistrations(list, "year").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(list.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by registration time and arrival", () => {
    expect(sortRegistrations(list, "registered").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(sortRegistrations(list, "status")[2].id).toBe("a");
  });
});

describe("placeholder emails", () => {
  it("hides placeholders from display", () => {
    expect(displayEmail(placeholderEmail("AB12"))).toBe("");
    expect(displayEmail("a@b.co")).toBe("a@b.co");
  });
});

describe("parseParticipantRows", () => {
  it("maps Google-Forms style headers by name, in any order", () => {
    const rows = [["Timestamp", "Email Address", "Full Name", "Branch", "Year", "Mobile"], ["t", "A@x.edu", "Asha", "CSE", "3", "999"]];
    expect(parseParticipantRows(rows).valid).toEqual([{ full_name: "Asha", email: "a@x.edu", roll_no: null, department: "CSE", year: 3, phone: "999" }]);
  });
  it("falls back to positional columns when there is no header", () => {
    const { valid } = parseParticipantRows([["Ravi", "r@x.edu", "21CS9", "ECE", "2", "888"]]);
    expect(valid[0]).toMatchObject({ full_name: "Ravi", email: "r@x.edu", roll_no: "21CS9", department: "ECE", year: 2, phone: "888" });
  });
  it("counts invalid emails and in-file duplicates", () => {
    const res = parseParticipantRows([["name", "email"], ["A", "a@x.edu"], ["A2", "A@x.edu"], ["B", "nope"], ["", "c@x.edu"]]);
    expect(res).toMatchObject({ invalid: 2, duplicates: 1 });
    expect(res.valid).toHaveLength(1);
  });
});
