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

  it("locks down events columns, ticket lookup and counts (security.sql sections 7 and 8)", () => {
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    // events: no table-wide read for API roles; anon gets a column list without the sheet link or budgets
    expect(/revoke select on public\.events from anon, authenticated/i.test(sec)).toBe(true);
    const anonGrant = sec.match(/grant select \(([^)]*)\) on public\.events to anon/i);
    expect(anonGrant).not.toBeNull();
    for (const secret of ["responses_sheet_url", "budget_allocated", "budget_spent"]) expect(anonGrant![1]).not.toContain(secret);
    // ticket lookups are server-only
    expect(/revoke execute on function public\.ticket_lookup\(text\) from public, anon, authenticated/i.test(sec)).toBe(true);
    expect(/grant execute on function public\.ticket_lookup\(text\) to service_role/i.test(sec)).toBe(true);
    // only triggers promote the waitlist
    expect(/revoke execute on function public\.promote_waitlist\(uuid\) from public, anon, authenticated/i.test(sec)).toBe(true);
  });

  it("retention purge also redacts feedback and trims audit and rate-limit rows (section 10)", () => {
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    const body = sec.slice(sec.indexOf("create or replace function public.purge_old_event_data(p_days int default 365, p_audit_days"));
    for (const t of ["event_registrations", "event_feedback", "audit_log", "rate_limits"]) expect(body.slice(0, 2000), t).toContain(t);
    expect(sec).toMatch(/revoke all on function public\.purge_old_event_data\(int, int\) from public, anon, authenticated/i);
  });

  it("constrains the remaining lead-writable fields (section 9)", () => {
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    for (const name of ["announcements_lengths_chk", "club_members_lengths_chk", "events_sheet_chk", "events_budget_chk", "event_registrations_ticket_chk"]) {
      expect(sec, name).toContain(name);
    }
  });

  it("pins club history fields and hides inactive clubs from the public (sections 11 and 12)", () => {
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    const guard = sec.slice(sec.indexOf("create or replace function public.guard_club_admin_fields()"));
    for (const col of ["slug", "category", "is_active", "created_at"]) expect(guard.slice(0, 700), col).toContain(`new.${col} := old.${col}`);
    // the replacement read policies must not be "using (true)"
    for (const policy of ["clubs_select", "events_select", "announcements_select"]) {
      const at = sec.indexOf(`create policy ${policy}`);
      expect(at, policy).toBeGreaterThan(-1);
      const body = sec.slice(at, sec.indexOf(";", at));
      expect(body, policy).not.toMatch(/using\s*\(\s*true\s*\)/i);
      expect(body, policy).toMatch(/is_active/);
    }
    for (const fn of ["event_accepts_registration", "event_accepts_feedback"]) {
      const at = sec.lastIndexOf(`create or replace function public.${fn}`);
      expect(sec.slice(at, at + 600), fn).toContain("c.is_active");
    }
  });

  it("only allowlisted views are readable by anon, and the public counts view lists published events only", () => {
    const VIEW_ALLOWLIST = new Set(["event_public_counts"]);
    const views = [...sql.matchAll(/grant select on public\.(\w+) to ([^;]*anon[^;]*);/gi)].map((m) => m[1]);
    for (const v of views) expect(VIEW_ALLOWLIST.has(v), `${v} readable by anon`).toBe(true);
    const sec = readFileSync(join(dir, "security.sql"), "utf8");
    expect(/create or replace view public\.event_public_counts[\s\S]*e\.status = 'published'/i.test(sec)).toBe(true);
  });
});
