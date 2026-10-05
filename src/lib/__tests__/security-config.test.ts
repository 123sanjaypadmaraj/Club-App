import { describe, expect, it } from "vitest";
import config from "../../../next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };
const get = async () => (await config.headers!()) as Rule[];
const val = (r: Rule, k: string) => r.headers.find((h) => h.key === k)?.value;

describe("security headers", () => {
  it("applies baseline headers to every path", async () => {
    const all = (await get()).find((r) => r.source === "/:path*")!;
    expect(val(all, "Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    expect(val(all, "X-Frame-Options")).toBe("DENY");
    expect(val(all, "X-Content-Type-Options")).toBe("nosniff");
  });
  it("sends the static CSP everywhere except dashboard and login (the proxy gives those a nonce CSP)", async () => {
    const r = (await get()).find((x) => x.headers.some((h) => h.key === "Content-Security-Policy"))!;
    const re = new RegExp("^" + r.source.replace("/:path*", "/.*") + "$");
    expect(re.test("/events/abc")).toBe(true);
    for (const p of ["/dashboard", "/dashboard/clubs", "/login", "/login/mfa"]) expect(re.test(p), p).toBe(false);
    const csp = val(r, "Content-Security-Policy")!;
    for (const d of ["object-src 'none'", "frame-ancestors 'none'", "form-action 'self'", "base-uri 'self'"]) expect(csp).toContain(d);
  });
  it("keeps ticket URLs out of Referer and caches", async () => {
    const r = (await get()).find((x) => x.source.startsWith("/ticket"))!;
    expect(val(r, "Referrer-Policy")).toBe("no-referrer");
    expect(val(r, "Cache-Control")).toContain("no-store");
  });
  it("marks signed-in and login pages no-store", async () => {
    const rules = await get();
    for (const p of ["/dashboard", "/login"]) {
      expect(val(rules.find((x) => x.source.startsWith(p))!, "Cache-Control")).toContain("no-store");
    }
  });
});
