import { describe, expect, it } from "vitest";
import { formatActionError } from "../log";

describe("formatActionError", () => {
  it("emits structured JSON with ids", () => {
    const o = JSON.parse(formatActionError("register", { code: "23505", message: "dup" }, { eventId: "e1" }));
    expect(o).toEqual({ level: "error", action: "register", code: "23505", message: "dup", eventId: "e1" });
  });
  it("tolerates a missing error", () => {
    const o = JSON.parse(formatActionError("x", null));
    expect(o.code).toBeNull();
    expect(o.message).toBeNull();
  });
});
