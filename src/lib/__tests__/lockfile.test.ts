import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Entry = { resolved?: string; integrity?: string; link?: boolean };
const lock = JSON.parse(readFileSync(join(__dirname, "../../../package-lock.json"), "utf8")) as { packages: Record<string, Entry> };

describe("package-lock.json", () => {
  it("resolves every dependency from the npm registry with a sha512 hash", () => {
    const bad: string[] = [];
    for (const [name, e] of Object.entries(lock.packages)) {
      if (!name || e.link || !e.resolved) continue; // "" is the root project
      if (!e.resolved.startsWith("https://registry.npmjs.org/")) bad.push(`${name}: ${e.resolved}`);
      else if (!e.integrity?.startsWith("sha512-")) bad.push(`${name}: missing sha512 integrity`);
    }
    expect(bad).toEqual([]);
  });
});
