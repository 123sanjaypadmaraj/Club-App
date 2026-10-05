import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../..");
const IGNORE = new Set(["NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE"]);

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" || f === "node_modules" ? [] : files(p);
    return /\.(ts|tsx|mjs|js)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

const example = readFileSync(join(root, ".env.example"), "utf8");
const documented = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));

describe(".env.example", () => {
  it("documents every environment variable the code reads", () => {
    const used = new Set<string>();
    for (const f of [...files(join(root, "src")), ...files(join(root, "scripts")), join(root, "next.config.ts")]) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)|process\.env\["([A-Z][A-Z0-9_]+)"\]|\benv\.([A-Z][A-Z0-9_]+)/g)) {
        used.add(m[1] ?? m[2] ?? m[3]);
      }
    }
    const missing = [...used].filter((n) => !IGNORE.has(n) && !documented.has(n));
    expect(missing).toEqual([]);
  });

  it("holds only placeholders, never a real secret", () => {
    for (const line of example.split(/\r?\n/)) {
      const value = line.split("=").slice(1).join("=").trim();
      if (!value || line.startsWith("#")) continue;
      expect(value, line).not.toMatch(/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/); // JWT
      expect(value, line).not.toMatch(/^sb_secret_/);
      expect(value, line).not.toMatch(/^[A-Za-z0-9+/_-]{41,}={0,2}$/); // long key-like string
    }
  });
});
