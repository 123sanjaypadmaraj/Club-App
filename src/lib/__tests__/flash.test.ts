import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFlash, flashQuery, readFlash } from "../flash";

afterEach(() => vi.unstubAllEnvs());
const parse = (q: string) => Object.fromEntries(new URLSearchParams(q));

describe("flash messages with a key", () => {
  it("round-trips a signed message", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    expect(readFlash(parse(flashQuery("error", "Wrong password & more")))).toEqual({ error: "Wrong password & more" });
    expect(readFlash(parse(flashQuery("ok", "Saved")))).toEqual({ ok: "Saved" });
  });
  it("drops an unsigned message", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    expect(readFlash({ error: "Call 555-0100 to unlock your account" })).toEqual({});
  });
  it("drops a tampered message", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    const p = parse(flashQuery("error", "Saved"));
    expect(readFlash({ ...p, error: "Saved. Call 555-0100" })).toEqual({});
  });
  it("drops a message whose kind was swapped", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    const p = parse(flashQuery("error", "Nope"));
    expect(readFlash({ ok: p.error, fs: p.fs })).toEqual({});
  });
  it("rejects a signature made with another key", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    const q = flashQuery("ok", "Saved");
    vi.stubEnv("FLASH_SECRET", "k2");
    expect(readFlash(parse(q))).toEqual({});
  });
  it("derives a key from the service-role key when FLASH_SECRET is unset", () => {
    vi.stubEnv("FLASH_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const q = flashQuery("ok", "Saved");
    expect(q).toContain("&fs=");
    expect(readFlash(parse(q))).toEqual({ ok: "Saved" });
    expect(readFlash({ ok: "Saved" })).toEqual({});
  });
  it("applyFlash signs on a URL object", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    const url = new URL("https://x.test/login");
    applyFlash(url, "error", "Session expired");
    expect(readFlash(Object.fromEntries(url.searchParams))).toEqual({ error: "Session expired" });
  });
  it("ignores array and over-long values", () => {
    vi.stubEnv("FLASH_SECRET", "k1");
    expect(readFlash({ error: ["a", "b"] })).toEqual({});
  });
});

describe("flash messages without a key (local development)", () => {
  it("does not sign and accepts plain messages", () => {
    vi.stubEnv("FLASH_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(flashQuery("ok", "Saved")).toBe("ok=Saved");
    expect(readFlash({ ok: "Saved" })).toEqual({ ok: "Saved" });
  });
});

describe("flash producers", () => {
  it("no file outside flash.ts builds an ok= / error= query by hand", () => {
    const root = join(__dirname, "../..");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? (n === "__tests__" ? [] : walk(p)) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const bad: string[] = [];
    for (const f of walk(root)) {
      if (/lib[\\/]flash\.ts$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      if (/[?&](ok|error)=/.test(src) || /searchParams\.set\(\s*["'](ok|error)["']/.test(src) || /\$\{(k|kind)\}=\$\{encodeURIComponent/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
