import { describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: () => ({ insert }) }) }));
import { audit } from "../audit";

describe("audit", () => {
  it("writes actor, action, target and detail", async () => {
    insert.mockResolvedValueOnce({ error: null });
    await audit("a", "lead.deleted", "t", { n: 1 });
    expect(insert).toHaveBeenCalledWith({ actor: "a", action: "lead.deleted", target: "t", detail: { n: 1 } });
  });
  it("never throws when the write fails", async () => {
    insert.mockRejectedValueOnce(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(audit("a", "x")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

import { AUDIT_ACTIONS } from "../audit";
describe("AUDIT_ACTIONS", () => {
  it("has no duplicate action names", () => {
    const v = Object.values(AUDIT_ACTIONS);
    expect(new Set(v).size).toBe(v.length);
  });
});
