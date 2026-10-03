import { describe, expect, it } from "vitest";
import { dedupeMembers, filterMembers } from "../members";
import type { Member } from "../types";

const mk = (over: Partial<Member>): Member => ({
  id: "1", club_id: "c", full_name: "Asha Rao", email: "asha@x.edu", roll_no: "22CS101", department: "CSE",
  year: 2, phone: null, position: "Core", status: "active", joined_on: "2025-01-01", ...over,
});
const list = [
  mk({ id: "1" }),
  mk({ id: "2", full_name: "Ravi", email: null, roll_no: null, department: "ECE", position: "Member", status: "alumni" }),
];

describe("filterMembers", () => {
  it("returns everything for an empty query and status", () => {
    expect(filterMembers(list, "  ", "")).toHaveLength(2);
  });
  it("matches name, email, roll no, department and position case-insensitively", () => {
    expect(filterMembers(list, "ASHA", "").map((m) => m.id)).toEqual(["1"]);
    expect(filterMembers(list, "22cs", "").map((m) => m.id)).toEqual(["1"]);
    expect(filterMembers(list, "ece", "").map((m) => m.id)).toEqual(["2"]);
    expect(filterMembers(list, "core", "").map((m) => m.id)).toEqual(["1"]);
  });
  it("filters by status and combines with the query", () => {
    expect(filterMembers(list, "", "alumni").map((m) => m.id)).toEqual(["2"]);
    expect(filterMembers(list, "asha", "alumni")).toEqual([]);
  });
});

describe("dedupeMembers", () => {
  const existing = [{ email: "Asha@X.edu", roll_no: "22CS101" }, { email: null, roll_no: " 22EC7 " }];
  it("drops an email match, case-insensitively", () => {
    const r = dedupeMembers([{ email: "asha@x.edu", roll_no: null }, { email: "new@x.edu", roll_no: null }], existing);
    expect(r.duplicates).toBe(1);
    expect(r.fresh.map((m) => m.email)).toEqual(["new@x.edu"]);
  });
  it("matches by roll number when there is no email", () => {
    const r = dedupeMembers([{ email: null, roll_no: "22ec7" }, { email: null, roll_no: "22EC8" }], existing);
    expect(r.duplicates).toBe(1);
    expect(r.fresh).toHaveLength(1);
  });
  it("drops in-batch duplicates", () => {
    const r = dedupeMembers([{ email: "a@x.edu" }, { email: "A@x.edu" }, { email: null, roll_no: "9" }, { email: null, roll_no: "9" }], []);
    expect(r.duplicates).toBe(2);
    expect(r.fresh).toHaveLength(2);
  });
  it("always keeps rows with no keys", () => {
    const r = dedupeMembers([{ email: null, roll_no: null }, { email: "", roll_no: "" }], existing);
    expect(r.duplicates).toBe(0);
    expect(r.fresh).toHaveLength(2);
  });
});
