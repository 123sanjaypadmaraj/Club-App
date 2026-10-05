import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../../supabase");
const sql = ["schema.sql", "event_ops.sql", "security.sql", "responses_sheet.sql"]
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n")
  .replace(/--[^\n]*/g, ""); // strip line comments so commented-out statements don't count

/** Functions any signed-out visitor may call on purpose. Adding to this list should be a conscious security decision. */
const ANON_CALLABLE = new Set(["ticket_lookup"]);
/** Helpers used inside RLS policies. They only answer questions about the caller or a public event, so open execution is fine. */
const POLICY_HELPERS = new Set(["is_admin", "manages_club", "manages_event", "event_accepts_registration", "event_accepts_feedback"]);

function functions() {
  const out: { name: string; body: string; isTrigger: boolean }[] = [];
  const re = /create (?:or replace )?function public\.(\w+)\(([\s\S]*?)\$\$;?/gi;
  for (const m of sql.matchAll(re)) out.push({ name: m[1], body: m[0], isTrigger: /returns trigger/i.test(m[0]) });
  return out;
}

describe("supabase SQL security", () => {
  it("enables row level security on every table", () => {
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(5);
    for (const t of tables) {
      expect(new RegExp(String.raw`alter table public\.${t}\s+enable row level security`, "i").test(sql), `RLS on ${t}`).toBe(true);
    }
  });

  it("pins search_path on every security definer function", () => {
    for (const f of functions().filter((x) => /security definer/i.test(x.body))) {
      expect(/set search_path/i.test(f.body), `search_path on ${f.name}`).toBe(true);
    }
  });

  it("revokes or deliberately grants every callable security definer function", () => {
    const granted = new Set([...sql.matchAll(/grant execute on function public\.(\w+)\([^)]*\)\s+to\s+([^;]+);/gi)].map((m) => m[1]));
    const revoked = new Set([...sql.matchAll(/revoke all on function public\.(\w+)\(/gi)].map((m) => m[1]));
    for (const f of functions().filter((x) => /security definer/i.test(x.body) && !x.isTrigger)) {
      const hasPolicy = granted.has(f.name) || revoked.has(f.name) || ANON_CALLABLE.has(f.name) || POLICY_HELPERS.has(f.name);
      expect(hasPolicy, `${f.name} must be revoked from public or explicitly granted`).toBe(true);
    }
  });

  it("only ticket_lookup is granted to anon", () => {
    const toAnon = [...sql.matchAll(/grant execute on function public\.(\w+)\([^)]*\)\s+to\s+([^;]+);/gi)].filter((m) => /\banon\b/.test(m[2])).map((m) => m[1]);
    for (const name of toAnon) expect(ANON_CALLABLE.has(name), `${name} granted to anon`).toBe(true);
  });

  it("keeps service-only tables closed to API roles", () => {
    expect(/revoke all on public\.rate_limits from anon, authenticated/i.test(sql)).toBe(true);
    expect(/revoke insert, update, delete on public\.audit_log from anon, authenticated/i.test(sql)).toBe(true);
    expect(/create policy \w+ on public\.rate_limits/i.test(sql)).toBe(false);
    expect(/create policy \w+ on public\.audit_log for (insert|update|delete|all)/i.test(sql)).toBe(false);
  });

  it("moves public sign-ups behind server-only functions", () => {
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    expect(/drop policy if exists registrations_insert/i.test(sec)).toBe(true);
    expect(/drop policy if exists feedback_insert/i.test(sec)).toBe(true);
    for (const fn of ["submit_registration", "submit_feedback"]) {
      expect(sec.includes(`grant execute on function public.${fn}(`), fn).toBe(true);
    }
  });
});
