import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "../supabase/cookies";

describe("sessionCookieOptions", () => {
  it("is httpOnly and lax, secure only in production", () => {
    expect(sessionCookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(sessionCookieOptions(false).secure).toBe(false);
    expect(sessionCookieOptions(false).httpOnly).toBe(true);
  });
});

describe("session cookie wiring", () => {
  const root = join(__dirname, "../..");
  for (const f of ["lib/supabase/server.ts", "proxy.ts"]) {
    it(`${f} applies the session cookie flags to every cookie it writes`, () => {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).toContain("cookieOptions: SESSION_COOKIE_OPTIONS");
      expect(src).toContain("...SESSION_COOKIE_OPTIONS");
    });
  }
  it("no client code reads document.cookie", () => {
    const walk = (dir: string): string[] => {
      return readdirSync(dir).flatMap((n: string) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? (n === "__tests__" ? [] : walk(p)) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    };
    const hits = walk(root).filter((p) => readFileSync(p, "utf8").includes("document.cookie"));
    expect(hits).toEqual([]);
  });
});
