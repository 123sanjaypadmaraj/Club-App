import { describe, expect, it } from "vitest";
import { buildCsp } from "../csp";

const scriptSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("script-src"))!;
describe("buildCsp", () => {
  it("uses the nonce and drops unsafe-inline for scripts", () => {
    const s = scriptSrc(buildCsp({ nonce: "abc", isDev: false }));
    expect(s).toContain("'nonce-abc'");
    expect(s).toContain("'strict-dynamic'");
    expect(s).not.toContain("'unsafe-inline'");
    expect(s).not.toContain("unsafe-eval");
  });
  it("allows unsafe-eval only in dev", () => {
    expect(scriptSrc(buildCsp({ nonce: "abc", isDev: true }))).toContain("'unsafe-eval'");
  });
  it("falls back to unsafe-inline without a nonce and keeps the hard directives", () => {
    const csp = buildCsp({ isDev: false });
    expect(scriptSrc(csp)).toContain("'unsafe-inline'");
    for (const d of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
  });
});
