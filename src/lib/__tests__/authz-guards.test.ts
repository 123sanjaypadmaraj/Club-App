import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GUARD = /requireAdmin|requireClubAccess|requireProfile|getProfile/;
const root = join(__dirname, "../../app/dashboard");

/** Each exported async function's opening lines must call an auth guard, so a new action can't ship unprotected. */
function unguarded(file: string, re: RegExp): string[] {
  const src = readFileSync(file, "utf8");
  return src
    .split(re)
    .slice(1)
    .filter((chunk) => !GUARD.test(chunk.split("\n").slice(0, 8).join("\n")))
    .map((c) => c.split("(")[0].trim());
}

describe("authorization guards", () => {
  it("every dashboard server action starts with an auth check", () => {
    expect(unguarded(join(root, "actions.ts"), /export async function /)).toEqual([]);
  });
  it("every export route checks the caller", () => {
    for (const d of readdirSync(join(root, "export"))) {
      expect(unguarded(join(root, "export", d, "route.ts"), /export async function /), d).toEqual([]);
    }
  });
});
