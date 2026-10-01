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
