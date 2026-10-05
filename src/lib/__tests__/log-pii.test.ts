import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatActionError, redactMessage } from "../log";

/** Keys that may appear in the extra/detail objects passed to logging and audit calls: ids, counts and flags only. */
const ALLOWED_KEYS = new Set([
  "slug", "eventId", "regId", "memberId", "announcementId", "userId", "clubId", "club_id", "event_id", "rows", "count",
  "added", "skipped", "scope", "code", "reason", "n", "message", "is_active", "factors", "clubs", "auditAction", "problem",
]);
const FORBIDDEN = /\b(email|full_name|phone|password|roll_no|ticket_code)\b/i;
const CALLS = /\b(logActionError|logSecurityEvent|audit)\(/g;

/** Text of each call's argument list, found by balancing parentheses. */
export function callArguments(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(CALLS)) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

/** Keys of object literals inside an argument list (`key:` and shorthand forms). */
export function objectKeys(args: string): string[] {
  const keys: string[] = [];
  for (const lit of args.matchAll(/\{([^{}]*)\}/g)) {
    for (const part of lit[1].split(",")) {
      const key = part.trim().split(":")[0].trim();
      if (/^[A-Za-z_]\w*$/.test(key)) keys.push(key);
    }
  }
  return keys;
}

export function violations(src: string): string[] {
  const bad: string[] = [];
  for (const args of callArguments(src)) {
    for (const k of objectKeys(args)) if (!ALLOWED_KEYS.has(k)) bad.push(`key ${k}`);
    if (FORBIDDEN.test(args)) bad.push(`forbidden word in ${args.slice(0, 60)}`);
  }
  return bad;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("personal data stays out of logs and audit entries", () => {
  it("every logging and audit call passes only allowlisted ids and counts", () => {
    const root = join(__dirname, "../..");
    const found: string[] = [];
    for (const file of sourceFiles(root)) {
      const src = readFileSync(file, "utf8");
      // the helper definitions themselves are not call sites
      if (/lib[\\/](log|audit)\.ts$/.test(file)) continue;
      for (const v of violations(src)) found.push(`${file}: ${v}`);
    }
    expect(found).toEqual([]);
  });

  it("the scanner catches a call that logs an email", () => {
    expect(violations('logActionError("x", error, { email })')).not.toEqual([]);
    expect(violations('audit(actor, "a", t, { userId })')).toEqual([]);
  });
});

describe("redactMessage", () => {
  it("masks email addresses", () => {
    expect(redactMessage('duplicate key for asha@college.edu in table')).toBe("duplicate key for [email] in table");
  });
  it("leaves ordinary text and null alone", () => {
    expect(redactMessage("permission denied")).toBe("permission denied");
    expect(redactMessage(null)).toBeNull();
  });
  it("truncates to 300 characters", () => {
    expect(redactMessage("x".repeat(1000))!.length).toBe(300);
  });
  it("is applied by formatActionError", () => {
    const o = JSON.parse(formatActionError("a", { code: "1", message: "bad a@b.co" }));
    expect(o.message).toBe("bad [email]");
  });
});
