import { describe, expect, it } from "vitest";
import { newTicketCode, parseTicketCode } from "@/lib/tickets";

describe("tickets", () => {
  it("generates 16-char codes without ambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(newTicketCode()).toMatch(/^[A-HJKMNP-Z2-9]{16}$/);
  });
  it("generates distinct codes", () => {
    expect(new Set(Array.from({ length: 500 }, newTicketCode)).size).toBe(500);
  });
  it("parses raw codes, lowercase and ticket URLs", () => {
    expect(parseTicketCode(" abcd234567 ")).toBe("ABCD234567");
    expect(parseTicketCode("https://club-hub-kappa.vercel.app/ticket/ABCD234567")).toBe("ABCD234567");
  });
  it("rejects junk", () => {
    expect(parseTicketCode("")).toBeNull();
    expect(parseTicketCode("a b")).toBeNull();
    expect(parseTicketCode("ab")).toBeNull();
  });
});
