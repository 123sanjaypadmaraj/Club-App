import { describe, expect, it } from "vitest";
import { filterMembers } from "../members";
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
