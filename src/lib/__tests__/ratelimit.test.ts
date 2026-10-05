import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({}) }));

import { ipFromHeaders, limitKey } from "@/lib/ratelimit";

const h = (m: Record<string, string>) => (n: string) => m[n] ?? null;

describe("ipFromHeaders", () => {
  it("takes the first forwarded address", () => {
    expect(ipFromHeaders(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(ipFromHeaders(h({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(ipFromHeaders(h({}))).toBe("unknown");
  });
  it("rejects junk values", () => {
    expect(ipFromHeaders(h({ "x-forwarded-for": "<script>" }))).toBe("unknown");
  });
});

describe("limitKey", () => {
  it("hashes and is case-insensitive", () => {
    expect(limitKey("login", "Alice")).toBe(limitKey("login", "alice"));
    expect(limitKey("login", "alice")).not.toContain("alice");
    expect(limitKey("login", "a")).not.toBe(limitKey("feedback", "a"));
  });
});

describe("LIMITS_POLICY", () => {
  it("caps logins per account per day above the short window", async () => {
    const { LIMITS_POLICY } = await import("@/lib/ratelimit");
    expect(LIMITS_POLICY.loginUserDay.window).toBe(86400);
    expect(LIMITS_POLICY.loginUserDay.max).toBeGreaterThan(LIMITS_POLICY.loginUser.max);
  });
});
