// Creates one club-lead login per club in data/clubs.json and assigns it to that club.
//   node --env-file=.env.local scripts/create-club-accounts.mjs [--reset]
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, and seed_real_clubs.sql already run.
//   Username : short club name (stem, techforge, cseh …). Supabase needs an email, so it is stored as <username>@clubhub.example.com
//              (same mapping as src/lib/username.ts); nobody ever types that.
//   Password : random, written to club-accounts.csv (git-ignored). Hand each lead theirs; they can change it under Account.
//   Re-runs  : existing accounts are kept and only (re)assigned; add --reset to issue fresh passwords for them too.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const domain = "clubhub.example.com"; // keep in sync with src/lib/username.ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (run with --env-file=.env.local)."); process.exit(1); }

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { clubs } = JSON.parse(readFileSync(join(root, "data/clubs.json"), "utf8"));

// short, readable login names (the slugs are long: business-and-information-technology …)
const SHORT = {
  "business-and-information-technology": "bit", "cybersecurity-and-ethical-hacking": "cseh",
  "mobile-app-development": "mad", "tech-forge-club": "techforge", "green-energy": "greenenergy",
  "data-analytics": "dataanalytics", "ed-start-up": "edstartup", "evolve-ai": "evolveai",
};
const password = () => randomBytes(9).toString("base64url"); // 12 chars

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const rows = [["club", "username", "password"]];
for (const c of clubs) {
  const { data: club } = await sb.from("clubs").select("id").eq("slug", c.slug).maybeSingle();
  if (!club) { console.warn(`! ${c.slug}: club not in the database — run supabase/seed_real_clubs.sql first`); continue; }

  const email = `${SHORT[c.slug] ?? c.slug}@${domain}`.toLowerCase();
  const fullName = `${c.name} Lead`;
  let user = await findUser(email);
  let pw = "(unchanged)";
  if (!user) {
    pw = password();
    const { data, error } = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error || !data.user) { console.warn(`! ${c.slug}: ${error?.message ?? "could not create user"}`); continue; }
    user = data.user;
  } else if (args.reset) {
    pw = password();
    const { error } = await sb.auth.admin.updateUserById(user.id, { password: pw });
    if (error) { console.warn(`! ${c.slug}: could not reset password — ${error.message}`); continue; }
  }
  await sb.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  const { error } = await sb.from("club_leads").upsert({ club_id: club.id, user_id: user.id });
  if (error) { console.warn(`! ${c.slug}: could not assign lead — ${error.message}`); continue; }
  rows.push([c.name, email.split("@")[0], pw]);
  console.log(`✓ ${c.name.padEnd(48)} ${email.split("@")[0]}`);
}

const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
writeFileSync(join(root, "club-accounts.csv"), csv);
console.log(`\nWrote ${rows.length - 1} account(s) to club-accounts.csv — keep it private, it is git-ignored.`);
